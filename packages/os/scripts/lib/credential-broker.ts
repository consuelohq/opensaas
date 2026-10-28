import {
  recordCredentialControlPlaneAuditEvent,
  type ControlPlaneAuditActor,
} from './control-plane-audit';
import { loadNodeEncryptionPrivateKey } from './node-encryption-key-file';
import {
  credentialStatus,
  resolveCredentialForBroker,
} from './node-sealed-credential-store';

/**
 * The credential broker.
 *
 * `workspace-control-plane-contract.md` ("Runtime injection contract") requires every credential to
 * travel:
 *
 *   agent tool call -> authorization -> broker -> credential source
 *     -> smallest possible child process -> secret discarded
 *
 * This module is that broker. It is the only place a credential value is allowed to exist in
 * process memory, and the value is never returned to the caller: callers hand in an operation and
 * receive the operation's result.
 *
 * Bindings are declared against a *script id*, not a tool façade name. A tool is a wrapper; the bun
 * script is what actually executes and what actually needs the credential. Binding on the façade
 * would let two façades over one script drift apart on scope, and would re-declare the same grant
 * for every new wrapper.
 */

export type CredentialGrant = {
  bindingId: string;
  /** Script ids permitted to resolve this binding. Exact match; no globbing. */
  scriptIds: readonly string[];
  /** Environment variable the value is injected as, when injecting into a child process. */
  environmentVariable?: string;
};

export type CredentialBrokerPolicy = {
  workspaceId: string;
  nodeId: string;
  grants: readonly CredentialGrant[];
};

export type CredentialBrokerDenialReason =
  | 'UnknownBinding'
  | 'ScriptNotPermitted'
  | 'CredentialMissing';

export type CredentialBrokerErrorCode =
  | 'InvalidInput'
  | CredentialBrokerDenialReason
  | 'ResolutionFailure';

export class CredentialBrokerFailure extends Error {
  readonly _tag = 'CredentialBrokerError' as const;
  readonly code: CredentialBrokerErrorCode;

  constructor(code: CredentialBrokerErrorCode, message: string) {
    super(message);
    this.name = 'CredentialBrokerFailure';
    this.code = code;
  }
}

const fail = (code: CredentialBrokerErrorCode, message: string): never => {
  throw new CredentialBrokerFailure(code, message);
};

const requiredIdentifier = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || value.trim() === '') {
    fail('InvalidInput', `credential broker ${label} is required`);
  }
  return (value as string).trim();
};

export type CredentialUseRequest = {
  home: string;
  nodeHome: string;
  policy: CredentialBrokerPolicy;
  actor: ControlPlaneAuditActor;
  bindingId: string;
  /** The script that will consume the credential, not the tool façade wrapping it. */
  scriptId: string;
};

const findGrant = (
  policy: CredentialBrokerPolicy,
  bindingId: string,
): CredentialGrant | undefined =>
  policy.grants.find((grant) => grant.bindingId === bindingId);

/**
 * Reports whether a binding is resolvable, without resolving it. This is the surface an agent may
 * reach. It deliberately cannot distinguish "credential absent" from "you are not permitted",
 * beyond what the caller already knows from its own policy, and never touches the value.
 */
export function inspectCredential(input: {
  home: string;
  policy: CredentialBrokerPolicy;
  bindingId: string;
  scriptId: string;
}): { status: 'set' | 'missing'; permitted: boolean } {
  const bindingId = requiredIdentifier(input.bindingId, 'binding ID');
  const scriptId = requiredIdentifier(input.scriptId, 'script ID');
  const grant = findGrant(input.policy, bindingId);
  const permitted = grant !== undefined && grant.scriptIds.includes(scriptId);
  if (!permitted) return { status: 'missing', permitted: false };

  return {
    status: credentialStatus({
      home: input.home,
      workspaceId: input.policy.workspaceId,
      nodeId: input.policy.nodeId,
      bindingId,
    }),
    permitted: true,
  };
}

/**
 * Resolves a credential, hands it to `operation`, and discards it.
 *
 * The value is never returned, never logged, and never placed in the parent process environment.
 * Every call emits an audit event, including denials and failures, as the contract requires.
 */
export async function withCredential<A>(
  request: CredentialUseRequest,
  operation: (credential: string) => Promise<A> | A,
): Promise<A> {
  const bindingId = requiredIdentifier(request.bindingId, 'binding ID');
  const scriptId = requiredIdentifier(request.scriptId, 'script ID');

  const audit = (
    reasonCode: Parameters<
      typeof recordCredentialControlPlaneAuditEvent
    >[0]['reasonCode'],
    outcome: 'allowed' | 'denied' | 'failed',
  ): void => {
    try {
      recordCredentialControlPlaneAuditEvent({
        home: request.home,
        actor: request.actor,
        event: 'credential.resolved',
        reasonCode,
        outcome,
        bindingId,
        scriptId,
      });
    } catch (_error: unknown) {
      // An unwritable audit log must not become a covert way to resolve a credential without a
      // record, but it also must not mask the caller's real error. Resolution failures already
      // throw; for the success path the caller's operation has not run yet, so surface it.
      if (outcome === 'allowed') {
        fail('ResolutionFailure', 'credential audit event could not be recorded');
      }
    }
  };

  const grant = findGrant(request.policy, bindingId);
  if (!grant) {
    audit('credential_denied', 'denied');
    fail('UnknownBinding', 'credential binding is not declared for this workspace');
  }
  if (!grant!.scriptIds.includes(scriptId)) {
    audit('credential_denied', 'denied');
    fail(
      'ScriptNotPermitted',
      'script is not permitted to resolve this credential binding',
    );
  }

  let credential: string;
  try {
    credential = resolveCredentialForBroker({
      home: request.home,
      nodePrivateKeyJwk: loadNodeEncryptionPrivateKey({
        nodeHome: request.nodeHome,
        workspaceId: request.policy.workspaceId,
        nodeId: request.policy.nodeId,
      }),
      workspaceId: request.policy.workspaceId,
      nodeId: request.policy.nodeId,
      bindingId,
    });
  } catch (error: unknown) {
    const missing =
      (error as { code?: string }).code === 'CredentialNotFound';
    audit(missing ? 'credential_missing' : 'credential_failed', 'failed');
    if (missing) {
      fail(
        'CredentialMissing',
        'credential is not set on this node; no other node is consulted',
      );
    }
    fail('ResolutionFailure', 'credential could not be resolved on this node');
  }

  audit('credential_resolved', 'allowed');
  try {
    return await operation(credential!);
  } finally {
    // JavaScript strings are immutable, so this cannot scrub the value from memory. Dropping the
    // only reference we hold is the best available guarantee; the real protection is that the
    // value never leaves this function's scope.
    credential = '';
  }
}

/**
 * Builds an explicit child-process environment containing the requested credentials and nothing
 * else from the broker.
 *
 * `baseEnvironment` is passed through verbatim and must not be `process.env` with secrets already
 * in it — the point of this function is that the parent process never holds them.
 */
export async function withCredentialEnvironment<A>(
  input: {
    home: string;
    nodeHome: string;
    policy: CredentialBrokerPolicy;
    actor: ControlPlaneAuditActor;
    scriptId: string;
    bindingIds: readonly string[];
    baseEnvironment?: Record<string, string>;
  },
  operation: (environment: Record<string, string>) => Promise<A> | A,
): Promise<A> {
  const environment: Record<string, string> = { ...(input.baseEnvironment ?? {}) };

  const resolveNext = async (index: number): Promise<A> => {
    if (index >= input.bindingIds.length) {
      try {
        return await operation(environment);
      } finally {
        for (const key of Object.keys(environment)) {
          if (!(key in (input.baseEnvironment ?? {}))) delete environment[key];
        }
      }
    }
    const bindingId = input.bindingIds[index];
    const grant = findGrant(input.policy, bindingId);
    const variable = grant?.environmentVariable ?? bindingId;
    return withCredential(
      {
        home: input.home,
        nodeHome: input.nodeHome,
        policy: input.policy,
        actor: input.actor,
        bindingId,
        scriptId: input.scriptId,
      },
      async (credential) => {
        environment[variable] = credential;
        return resolveNext(index + 1);
      },
    );
  };

  return resolveNext(0);
}
