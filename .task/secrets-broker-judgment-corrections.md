# Secrets & Credential Broker — Judgment Corrections

Context for whoever picks this up: a prior chat produced a broker/custody design from scratch.
It is **directionally right and specifically wrong**. We already have a reviewed contract at
`packages/os/docs/workspace-control-plane-contract.md` that is further along than that proposal.

**Do not redesign from the outside-in proposal. Correct it against the existing contract.**

---

## 1. What the outside proposal got right (keep)

- Three roles: vault (bytes) / notebook (metadata) / broker (bouncer). Correct decomposition.
- Agents never receive values. Status only (`set` / `missing` / `invalid`).
- Environments are labels + non-secret config. Secrets attach to them; they do not live inside them.
- Railway/Vercel/Doppler/Infisical are the right UX references for the list surface.
- A powered-off laptop cannot serve the cloud node. Pure "we only broker to your keychain" is not a
  complete answer for an always-on node.

## 2. Where the judgment is wrong

### 2.1 Secrets do not bind to "tools". They bind to scripts.

The proposal says things like "GITHUB_TOKEN → git/github tools". That is the wrong layer for us.

Our stated architecture is: **a tool is a façade; a bun script is what executes.** The credential is
needed by the script's child process, not by the tool wrapper. So the binding is:

```
secret binding  ->  script  ->  node
                      ^
                      |
              tool (façade, never sees the value)
```

Binding at the tool layer means every new façade over the same script re-declares the same grant, and
two façades can drift out of sync on scope. Bind once at the script, let façades inherit.

This matters right now because our own tool/script naming is already inconsistent
(`filesystem` tool vs `fs` script). If we bind on the façade name we bake that drift into the
permission model.

### 2.2 It sequences the cloud node second. For us it is first.

The proposal's phase 1 is "keychain + runtime-env compat, inject for github/git", with node sealed
store in phase 2. It even admits "phase 1 alone does not fix always-on cloud" — and still puts it
second.

Our blocking constraint is the opposite: **the cloud node is not useful without credentials.** A
secrets product that only works on the machine that already has the secrets solves nothing we have.
Sealed store on the self-hosted node is phase 1, not phase 2.

### 2.3 It treats a secret as one value with several storage locations. It is not.

The proposal models custody as "where do the bytes for THIS secret live". Wrong for a multi-node
product. The correct model is two objects:

```ts
// control plane. metadata only. syncs across nodes.
type SecretBinding = {
  bindingId: string;
  workspaceId: string;
  name: string;              // GITHUB_TOKEN
  scriptPatterns: string[];  // which scripts may resolve it
  nodeIds: string[];         // which nodes may resolve it
  environmentId?: string;    // label only
};

// per node. never syncs. never enters the control plane.
type SecretMaterial = {
  bindingId: string;
  nodeId: string;
  source: 'this-device' | 'node-sealed' | 'onepassword' | 'bitwarden' | 'runtime-env';
  status: 'set' | 'missing' | 'invalid';
};
```

One binding, N materials. The same logical `DATABASE_URL` is legitimately **different bytes** on the
laptop and on the cloud node. Modelling it as one value that gets copied around is how you end up
running migrations against prod from a dev box.

Our contract already says this at line 194: *"A credential configured on one node is not
automatically available on another node."* The outside proposal contradicts it.

### 2.4 "We're just a broker so we never custody" is not honest once we run a cloud node.

The moment we operate the sealed store on a node we provisioned, we custody. The right framing is not
"we never hold keys" — it is:

> Consuelo brokers every resolution. Where the bytes rest is a per-node choice the user makes, and one
> of those choices is a sealed store on a node they own.

Custody means *nodes can resolve without the human online*. It does not mean *agents can read secrets*.
Keep those two sentences separate in any copy we write, because conflating them is what makes the
feature sound scarier than it is.

### 2.5 Drop "reveal".

The proposal wants click-to-reveal as a human ceremony. Skip it. It is a leak surface, it needs its own
audit path and re-auth ceremony, and the actual user need ("I need to check the value is right") is
better served by `status: invalid` from a live provider check. Ship **set / rotate / remove / replace**.
No read path, for anyone, ever. That is a much easier property to defend than a carefully-scoped one.

### 2.6 It omits node selection entirely — which is the actual open product question.

The proposal never addresses "which node am I running on". That is the thing we are actually trying to
decide. Credential resolution is **node-scoped**, so node selection and secret resolution are the same
feature seen from two ends:

- an agent picks a node (explicitly, or falls back to the workspace default);
- the broker resolves material for *that* node only;
- if that node has no material for the binding, the call fails closed with `missing` — it does **not**
  fall back to another node's copy.

No cross-node fallback. The home node is not a raw-secret relay (contract line 171).

---

## 3. The actual blocker, already documented

`workspace-control-plane-contract.md` line 353:

> ### Remote setup for a self-hosted node
> Remote entry of a native node credential requires a separate node encryption key and a reviewed
> sealed-delivery protocol. The current Ed25519 signing key must not be casually repurposed for
> encryption.
> **This remote ceremony is not part of the first native credential release.**

That deferral is exactly why the cloud node cannot get its environment variables. This is a known
deliberate gap, not a mystery. Un-deferring it is the cloud node's critical path.

What it concretely needs:

1. **A per-node X25519 encryption keypair**, minted at enrollment, distinct from the existing Ed25519
   signing key. Do not reuse the signing key. The contract already calls this out and it is correct —
   signing and encryption keys have different compromise blast radii and different rotation cadence.
2. **Sealed delivery**: the setup surface encrypts to the target node's public encryption key. The
   control plane relays an opaque blob it cannot open. Only the target node decrypts.
3. **Landing in the node sealed store**, not in a `.env`, not in the launchd/systemd unit environment,
   not in the parent process. Contract line 386: *"do not place secrets in the long-lived OS parent
   environment."*
4. **A redacted audit event** on write and on every resolution, success or failure (contract line 392).

## 4. Recommended sequence

| phase | scope | unblocks |
|---|---|---|
| 1 | node X25519 encryption key at enrollment + sealed-delivery ceremony + node sealed store | cloud node can hold its own credentials |
| 2 | `SecretBinding` / `SecretMaterial` split, node-scoped resolution, no cross-node fallback | correct multi-node semantics before habits form |
| 3 | secrets list UI (name / status / nodes / used-by scripts / set·rotate·remove) | the human surface |
| 4 | `this-device` keychain adapter wired through the same broker | laptop parity, no special-casing |
| 5 | 1Password / Bitwarden sources | teams |

Phases 1 and 2 are the ones with architectural consequences. 3–5 are additive and can be reordered.

## 5. Non-negotiables to restate in any implementation task

- No agent-facing read path for any credential value. Status only.
- No secret in an environment record's `plainValues`.
- No secret in the long-lived parent process environment.
- No cross-node credential fallback.
- Signing keys are not encryption keys.
- Every resolution emits a redacted audit event, including failures.
- A CLI never accepts a credential as a positional argument (shell history, `ps`).

## 6. Open questions that need a human decision

1. Does the cloud node's sealed store survive VM reimage, or is re-entry expected on every reprovision?
   (Affects whether the encryption key is bound to the instance or escrowed.)
2. When a binding is scoped to two nodes and only one has material, is the workspace-level status
   `set`, `partial`, or `missing`? Recommend `partial` — anything else lies on the list surface.
3. Is `runtime-env` a first-class source or bootstrap-only? Recommend bootstrap-only and visibly
   labelled as degraded, so it does not quietly become the default path.
