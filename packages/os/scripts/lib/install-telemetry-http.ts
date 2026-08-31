import fs from 'node:fs';
import path from 'node:path';

import {
  INSTALL_CONTROL_PLANE_DIAGNOSTIC_INGEST_PATH,
  INSTALL_CONTROL_PLANE_EVIDENCE_INGEST_PATH,
  INSTALL_CONTROL_PLANE_EVENT_INGEST_PATH,
  INSTALL_CONTROL_PLANE_OBSERVABILITY_CONFIG_PATH,
} from './install-control-plane-http';
import {
  INSTALL_ID_HEADER,
  type InstallTelemetryEvent,
} from './install-telemetry-contract';
import type {
  InstallerDiagnosticUploader,
  InstallerTelemetryEventSink,
  InstallerTelemetryEvidenceSink,
} from './install-telemetry';

type InstallerTelemetryHttpInput = {
  authorityOrigin?: string;
  fetchImpl?: typeof fetch;
};

const DEFAULT_AUTHORITY_ORIGIN = 'https://os.consuelohq.com';
const DEFAULT_CONFIG_TIMEOUT_MS = 2_000;

export type InstallerObservabilityConfig = {
  sentryDsn?: string;
};

function endpoint(origin: string, pathname: string): string {
  return new URL(pathname, origin.endsWith('/') ? origin : `${origin}/`).toString();
}

function requireAccepted(response: Response, label: string): void {
  if (response.status === 202) return;
  throw new Error(`${label} failed with HTTP ${response.status}`);
}

function validSentryDsn(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const candidate = value.trim();
  if (!candidate) return undefined;
  try {
    const url = new URL(candidate);
    return url.protocol === 'https:' && url.username && url.hostname && url.pathname !== '/'
      ? candidate
      : undefined;
  } catch {
    return undefined;
  }
}

export async function fetchInstallerObservabilityConfig(
  input: InstallerTelemetryHttpInput & { timeoutMs?: number } = {},
): Promise<InstallerObservabilityConfig> {
  const origin = input.authorityOrigin ?? DEFAULT_AUTHORITY_ORIGIN;
  const fetchImpl = input.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Math.max(1, input.timeoutMs ?? DEFAULT_CONFIG_TIMEOUT_MS),
  );
  try {
    const response = await fetchImpl(
      endpoint(origin, INSTALL_CONTROL_PLANE_OBSERVABILITY_CONFIG_PATH),
      {
        method: 'GET',
        headers: { accept: 'application/json' },
        signal: controller.signal,
      },
    );
    if (!response.ok) return {};
    const parsed = (await response.json()) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const sentryDsn = validSentryDsn(
      (parsed as Record<string, unknown>).sentryDsn,
    );
    return sentryDsn ? { sentryDsn } : {};
  } catch {
    return {};
  } finally {
    clearTimeout(timeout);
  }
}

function publicInstallerProjection(event: InstallTelemetryEvent): InstallTelemetryEvent {
  return {
    ...event,
    producer: 'installer',
    identity: {
      state: 'anonymous',
      ...(event.identity.nodeId ? { nodeId: event.identity.nodeId } : {}),
    },
  };
}

export function createInstallerTelemetryHttpEventSink(
  input: InstallerTelemetryHttpInput = {},
): InstallerTelemetryEventSink {
  const origin = input.authorityOrigin ?? DEFAULT_AUTHORITY_ORIGIN;
  const fetchImpl = input.fetchImpl ?? fetch;
  return (event) => fetchImpl(endpoint(origin, INSTALL_CONTROL_PLANE_EVENT_INGEST_PATH), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [INSTALL_ID_HEADER]: event.installId,
      },
      body: JSON.stringify(publicInstallerProjection(event)),
    }).then((response) => requireAccepted(response, 'install telemetry ingest'));
}

export function createInstallerDiagnosticHttpUploader(
  input: InstallerTelemetryHttpInput = {},
): InstallerDiagnosticUploader {
  const origin = input.authorityOrigin ?? DEFAULT_AUTHORITY_ORIGIN;
  const fetchImpl = input.fetchImpl ?? fetch;
  return ({ installId, outcome, reportDir }) => {
    const reportPath = path.join(reportDir, 'install-report.json');
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as unknown;
    return fetchImpl(endpoint(origin, INSTALL_CONTROL_PLANE_DIAGNOSTIC_INGEST_PATH), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [INSTALL_ID_HEADER]: installId,
      },
      body: JSON.stringify({ installId, outcome, diagnostic: report }),
    }).then((response) => requireAccepted(response, 'install diagnostic upload'));
  };
}

export function createInstallerSentryEvidenceHttpSink(
  input: InstallerTelemetryHttpInput = {},
): InstallerTelemetryEvidenceSink {
  const origin = input.authorityOrigin ?? DEFAULT_AUTHORITY_ORIGIN;
  const fetchImpl = input.fetchImpl ?? fetch;
  return (evidence) => fetchImpl(endpoint(origin, INSTALL_CONTROL_PLANE_EVIDENCE_INGEST_PATH), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [INSTALL_ID_HEADER]: evidence.installId,
      },
      body: JSON.stringify(evidence),
    }).then((response) => requireAccepted(response, 'install evidence ingest'));
}
