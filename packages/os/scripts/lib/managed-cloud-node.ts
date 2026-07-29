export type ManagedNodeLifecycle =
  | 'requested'
  | 'provisioning'
  | 'booting'
  | 'enrolling'
  | 'online'
  | 'stopping'
  | 'stopped'
  | 'failed'
  | 'deleting';

export type ManagedNodeHosting = {
  kind: 'consuelo-managed';
  provider: 'gcp';
  providerProjectId: string;
  providerResourceId?: string;
  region: string;
  zone?: string;
  lifecycle: ManagedNodeLifecycle;
};

export type FoundationResourceStatus = 'created' | 'unchanged';

export type ManagedCloudNodeFoundationClient = {
  ensureService: (service: string) => Promise<FoundationResourceStatus>;
  ensureNetwork: (input: {
    name: string;
    projectId: string;
  }) => Promise<FoundationResourceStatus>;
  ensureSubnet: (input: {
    name: string;
    projectId: string;
    network: string;
    region: string;
    cidr: string;
  }) => Promise<FoundationResourceStatus>;
  ensureRouter: (input: {
    name: string;
    projectId: string;
    region: string;
    network: string;
    asn: number;
  }) => Promise<FoundationResourceStatus>;
  ensureNat: (input: {
    name: string;
    projectId: string;
    region: string;
    router: string;
    sourceSubnetworkIpRangesToNat: 'ALL_SUBNETWORKS_ALL_IP_RANGES';
    autoAllocateExternalIps: true;
    logging: { enabled: true; filter: 'ERRORS_ONLY' };
  }) => Promise<FoundationResourceStatus>;
  ensureFirewallRule: (input: {
    name: string;
    projectId: string;
    network: string;
    sourceRanges: string[];
    targetTags: string[];
    allowed: string[];
  }) => Promise<FoundationResourceStatus>;
  ensureServiceAccount: (input: {
    accountId: string;
    displayName: string;
    projectId: string;
  }) => Promise<FoundationResourceStatus>;
  ensureProjectRoleBinding: (input: {
    member: string;
    projectId: string;
    role: string;
  }) => Promise<FoundationResourceStatus>;
  ensureSnapshotPolicy: (
    input: ManagedCloudNodeSnapshotPolicy & {
      projectId: string;
      region: string;
      labels: Record<string, string>;
    },
  ) => Promise<FoundationResourceStatus>;
  ensureBudget: (input: {
    billingAccountId: string;
    displayName: string;
    projectId: string;
    amountUsd: number;
    thresholdPercents: number[];
  }) => Promise<FoundationResourceStatus>;
};

export type ManagedCloudNodeSnapshotPolicy = {
  name: string;
  frequency: 'daily' | 'weekly';
  startTime: string;
  retentionDays: number;
  weekday?: string;
  keepAfterDiskDelete: boolean;
};

export type ManagedCloudNodeFoundationPlan = {
  provider: 'gcp';
  projectId: string;
  billingAccountId: string;
  region: string;
  labels: Record<string, string>;
  services: string[];
  network: { name: string };
  subnet: { name: string; cidr: string };
  router: { name: string; asn: number };
  nat: {
    name: string;
    router: string;
    sourceSubnetworkIpRangesToNat: 'ALL_SUBNETWORKS_ALL_IP_RANGES';
    autoAllocateExternalIps: true;
    logging: { enabled: true; filter: 'ERRORS_ONLY' };
  };
  firewallRules: Array<{
    name: string;
    sourceRanges: string[];
    targetTags: string[];
    allowed: string[];
  }>;
  serviceAccount: {
    accountId: string;
    displayName: string;
    roles: string[];
  };
  snapshotPolicies: ManagedCloudNodeSnapshotPolicy[];
  budget: {
    displayName: string;
    amountUsd: number;
    thresholdPercents: number[];
  };
};

export type ManagedCloudNodeFoundationOperation = {
  resource: string;
  status: 'planned' | FoundationResourceStatus;
};

export class ManagedCloudNodeError extends Error {
  readonly code: string;

  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ManagedCloudNodeError';
    this.code = code;
  }
}

export const MANAGED_NODE_DATA_RETENTION = {
  vmDeletePreservesDataDisk: true,
  ordinaryNodeDeletePreservesData: true,
  permanentDataDeletionRequiresExplicitAction: true,
} as const;

export const PERMANENT_DATA_DELETE_CONFIRMATION =
  'DELETE_MANAGED_NODE_DATA_PERMANENTLY';

export type ManagedCloudNodeReleaseBootstrap = {
  channel: 'stable' | 'beta' | 'canary' | 'dev';
  baseUrl: string;
  bootstrapBundleUrl: string;
  bootstrapBundleDigest: string;
  bootstrapBundleId: string;
  bootstrapBundleVersion: string;
  cloudflaredBinaryUrl: string;
  cloudflaredBinaryDigest: string;
  cloudflaredVersion: string;
  caddyArchiveUrl: string;
  caddyArchiveDigest: string;
  caddyVersion: string;
  trustedPublicKeys: Record<string, string>;
};

export type ManagedCloudNodeDataDisk = {
  name: string;
  sizeGb: number;
  type: string;
  deviceName: string;
  autoDelete: false;
  snapshotPolicies: string[];
};

export type ManagedCloudNodeInstance = {
  name: string;
  machineType: string;
  network: string;
  subnet: string;
  noExternalIp: true;
  serviceAccountEmail: string;
  scopes: string[];
  tags: string[];
  bootDisk: {
    sizeGb: number;
    type: string;
    imageFamily: string;
    imageProject: string;
    autoDelete: true;
  };
  dataDisk: {
    name: string;
    deviceName: string;
    autoDelete: false;
  };
  shielded: {
    secureBoot: true;
    vTPM: true;
    integrityMonitoring: true;
  };
  metadata: Record<string, string>;
};

export type ManagedCloudNodePlan = {
  provider: 'gcp';
  projectId: string;
  workspaceId: string;
  workspaceSlug: string;
  workspaceHost: string;
  nodeId: string;
  nodeName: string;
  region: string;
  zone: string;
  labels: Record<string, string>;
  release: ManagedCloudNodeReleaseBootstrap;
  releaseBucket: string;
  dataDisk: ManagedCloudNodeDataDisk;
  instance: ManagedCloudNodeInstance;
  bootstrap: {
    home: string;
    mountPath: string;
    statusPath: string;
    enrollmentStatusPath: string;
    startupScript: string;
  };
};

export type ManagedCloudNodeClient = {
  ensureReleaseBucketAccess: (input: {
    bucketName: string;
    member: string;
    role: 'roles/storage.objectViewer';
  }) => Promise<FoundationResourceStatus>;
  ensureDataDisk: (
    input: ManagedCloudNodeDataDisk & {
      projectId: string;
      zone: string;
      labels: Record<string, string>;
    },
  ) => Promise<FoundationResourceStatus>;
  ensureSnapshotPolicyAttachment: (input: {
    projectId: string;
    zone: string;
    diskName: string;
    policyName: string;
  }) => Promise<FoundationResourceStatus>;
  ensureInstance: (
    input: ManagedCloudNodeInstance & {
      projectId: string;
      zone: string;
      labels: Record<string, string>;
    },
  ) => Promise<FoundationResourceStatus>;
};

export type ManagedCloudNodeOperation = {
  resource: string;
  status: 'planned' | FoundationResourceStatus;
};

const DEFAULT_SERVICES = [
  'billingbudgets.googleapis.com',
  'cloudbilling.googleapis.com',
  'cloudresourcemanager.googleapis.com',
  'compute.googleapis.com',
  'iam.googleapis.com',
  'iamcredentials.googleapis.com',
  'iap.googleapis.com',
  'logging.googleapis.com',
  'monitoring.googleapis.com',
  'oslogin.googleapis.com',
  'serviceusage.googleapis.com',
] as const;

const requireNonEmpty = (value: string, name: string): string => {
  const normalized = value.trim();
  if (!normalized) {
    throw new ManagedCloudNodeError(
      'MANAGED_NODE_INPUT_INVALID',
      `${name} is required`,
    );
  }
  return normalized;
};

const RELEASE_CHANNELS = new Set(['stable', 'beta', 'canary', 'dev']);

const requireReleaseChannel = (
  value: string,
): ManagedCloudNodeReleaseBootstrap['channel'] => {
  if (!RELEASE_CHANNELS.has(value)) {
    throw new ManagedCloudNodeError(
      'MANAGED_NODE_INPUT_INVALID',
      'release.channel must be stable, beta, canary, or dev',
    );
  }
  return value as ManagedCloudNodeReleaseBootstrap['channel'];
};

const canonicalWorkspaceHost = (value: string): string => {
  const normalized = requireNonEmpty(value, 'workspaceHost');
  let parsed: URL;
  try {
    parsed = new URL(
      normalized.includes('://') ? normalized : 'https://' + normalized,
    );
  } catch (error: unknown) {
    throw new ManagedCloudNodeError(
      'MANAGED_NODE_INPUT_INVALID',
      'workspaceHost must be a valid hostname',
      { cause: error },
    );
  }
  if (
    parsed.protocol !== 'https:' ||
    parsed.username ||
    parsed.password ||
    parsed.port
  ) {
    throw new ManagedCloudNodeError(
      'MANAGED_NODE_INPUT_INVALID',
      'workspaceHost must be an HTTPS hostname without credentials or a port',
    );
  }
  return parsed.hostname.toLowerCase();
};

const trustedGcsUrl = (
  value: string,
  name: string,
): { url: string; bucket: string } => {
  const url = requireHttpsUrl(value, name);
  const parsed = new URL(url);
  const parts = parsed.pathname.split('/').filter(Boolean);
  if (parsed.hostname !== 'storage.googleapis.com' || parts.length === 0) {
    throw new ManagedCloudNodeError(
      'MANAGED_NODE_INPUT_INVALID',
      name + ' must use an approved Google Cloud Storage origin',
    );
  }
  return { url, bucket: parts[0] };
};

const SUBNET_CIDRS: Record<string, string> = {
  'us-east1': '10.70.0.0/20',
  'us-east4': '10.70.16.0/20',
  'us-central1': '10.70.32.0/20',
  'us-west1': '10.70.48.0/20',
  'europe-west1': '10.70.64.0/20',
};
const requireHttpsUrl = (value: string, name: string): string => {
  const normalized = requireNonEmpty(value, name);
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch (error: unknown) {
    throw new ManagedCloudNodeError(
      'MANAGED_NODE_INPUT_INVALID',
      `${name} must be an absolute HTTPS URL`,
      { cause: error },
    );
  }
  if (parsed.protocol !== 'https:') {
    throw new ManagedCloudNodeError(
      'MANAGED_NODE_INPUT_INVALID',
      `${name} must use HTTPS`,
    );
  }
  return parsed.toString().replace(/\/$/, '');
};

const requireSha256 = (value: string, name: string): string => {
  const normalized = requireNonEmpty(value, name).toLowerCase();
  if (!/^sha256:[a-f0-9]{64}$/.test(normalized)) {
    throw new ManagedCloudNodeError(
      'MANAGED_NODE_INPUT_INVALID',
      `${name} must use sha256:<64 lowercase hex>`,
    );
  }
  return normalized;
};

const normalizeResourceLabel = (value: string, name: string): string => {
  const normalized = requireNonEmpty(value, name)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
    .slice(0, 50)
    .replace(/-+$/g, '');
  if (!normalized) {
    throw new ManagedCloudNodeError(
      'MANAGED_NODE_INPUT_INVALID',
      `${name} does not contain a resource-safe label`,
    );
  }
  return normalized;
};

const shellSingleQuote = (value: string): string =>
  `'${value.replaceAll("'", `'\"'\"'`)}'`;

const renderManagedCloudNodeStartupScript = (input: {
  projectId: string;
  workspaceId: string;
  workspaceSlug: string;
  workspaceHost: string;
  nodeId: string;
  nodeName: string;
  release: ManagedCloudNodeReleaseBootstrap;
  home: string;
  statusPath: string;
  enrollmentStatusPath: string;
}): string => {
  const releaseKeys = JSON.stringify(input.release.trustedPublicKeys);
  const digest = input.release.bootstrapBundleDigest.slice('sha256:'.length);
  const cloudflaredDigest = input.release.cloudflaredBinaryDigest.slice(
    'sha256:'.length,
  );
  const caddyDigest = input.release.caddyArchiveDigest.slice('sha256:'.length);
  const bundleDirectory = input.release.bootstrapBundleId.replace(':', '-');
  const onboarding = JSON.stringify({
    schemaVersion: 1,
    projectId: input.projectId,
    workspaceId: input.workspaceId,
    workspaceSlug: input.workspaceSlug,
    workspaceHost: input.workspaceHost,
    nodeId: input.nodeId,
    nodeName: input.nodeName,
    authorityOrigin: 'https://os.consuelohq.com',
  });

  return [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    '',
    `CONSUELO_HOME=${shellSingleQuote(input.home)}`,
    `STATUS_PATH=${shellSingleQuote(input.statusPath)}`,
    `ENROLLMENT_STATUS_PATH=${shellSingleQuote(input.enrollmentStatusPath)}`,
    "DATA_DEVICE='/dev/disk/by-id/google-consuelo-data'",
    "ALLOW_DATA_DISK_FORMAT='false'",
    "BOOT_DISK_FORMAT_MARKER='/var/lib/consuelo-bootstrap/data-disk-formatted'",
    "BOOTSTRAP_ROOT='/opt/consuelo/bootstrap'",
    `BUNDLE_DIR="$BOOTSTRAP_ROOT/${bundleDirectory}"`,
    'BUNDLE_ARCHIVE="$BOOTSTRAP_ROOT/runtime.tar.gz"',
    'CLOUDFLARED_PATH="$CONSUELO_HOME/bin/cloudflared"',
    'CADDY_PATH="$CONSUELO_HOME/bin/caddy"',
    'CADDY_ARCHIVE="$BOOTSTRAP_ROOT/caddy.tar.gz"',
    "METADATA_TOKEN_URL='http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token'",
    '',
    'write_status() {',
    '  local phase="$1"',
    '  local detail="${2:-}"',
    '  install -d -m 0700 "$(dirname "$STATUS_PATH")"',
    '  printf \'{"schemaVersion":1,"phase":"%s","detail":"%s"}\\n\' "$phase" "$detail" > "$STATUS_PATH"',
    '  chmod 0600 "$STATUS_PATH"',
    '}',
    "trap 'write_status failed bootstrap-error' ERR",
    'write_status preparing-disk',
    '',
    'for attempt in $(seq 1 60); do',
    '  [ -e "$DATA_DEVICE" ] && break',
    '  sleep 2',
    'done',
    '[ -e "$DATA_DEVICE" ]',
    'if ! blkid "$DATA_DEVICE" >/dev/null 2>&1; then',
    '  [ "$ALLOW_DATA_DISK_FORMAT" = true ]',
    '  [ ! -e "$BOOT_DISK_FORMAT_MARKER" ]',
    '  install -d -m 0700 "$(dirname "$BOOT_DISK_FORMAT_MARKER")"',
    '  mkfs.ext4 -F -L consuelo-data "$DATA_DEVICE"',
    '  touch "$BOOT_DISK_FORMAT_MARKER"',
    'fi',
    'install -d -m 0700 "$CONSUELO_HOME"',
    'if ! mountpoint -q "$CONSUELO_HOME"; then',
    '  DATA_UUID="$(blkid -s UUID -o value "$DATA_DEVICE")"',
    '  grep -q "UUID=$DATA_UUID " /etc/fstab || printf \'UUID=%s %s ext4 defaults,nofail 0 2\\n\' "$DATA_UUID" "$CONSUELO_HOME" >> /etc/fstab',
    '  mount "$CONSUELO_HOME"',
    'fi',
    '',
    'id consuelo >/dev/null 2>&1 || useradd --create-home --shell /bin/bash consuelo',
    'chown consuelo:consuelo "$CONSUELO_HOME"',
    'loginctl enable-linger consuelo',
    'CONSUELO_UID="$(id -u consuelo)"',
    'CONSUELO_USER_HOME="$(getent passwd consuelo | cut -d: -f6)"',
    'BUN_BIN="$CONSUELO_USER_HOME/.bun/bin/bun"',
    'systemctl start "user@${CONSUELO_UID}.service"',
    '',
    'write_status installing-dependencies',
    'export DEBIAN_FRONTEND=noninteractive',
    'apt-get update -y',
    'apt-get install -y ca-certificates curl jq tar gzip unzip',
    'if [ ! -x "$BUN_BIN" ]; then',
    '  runuser -u consuelo -- bash -lc "curl -fsSL https://bun.sh/install | bash"',
    'fi',
    '[ -x "$BUN_BIN" ]',
    '',
    'gcp_access_token() {',
    '  curl -fsS -H "Metadata-Flavor: Google" "$METADATA_TOKEN_URL" | jq -er \'.access_token\'',
    '}',
    '',
    'write_status downloading-runtime',
    'install -d -m 0755 "$BOOTSTRAP_ROOT" "$BUNDLE_DIR"',
    `curl -fsSL -H "Authorization: Bearer $(gcp_access_token)" ${shellSingleQuote(input.release.bootstrapBundleUrl)} -o "$BUNDLE_ARCHIVE"`,
    `printf '%s  %s\\n' ${shellSingleQuote(digest)} "$BUNDLE_ARCHIVE" | sha256sum -c -`,
    'tar -xzf "$BUNDLE_ARCHIVE" -C "$BUNDLE_DIR"',
    '',
    'write_status installing-cloudflared',
    'install -d -m 0755 "$CONSUELO_HOME/bin"',
    `curl -fsSL ${shellSingleQuote(input.release.cloudflaredBinaryUrl)} -o "$CLOUDFLARED_PATH"`,
    `printf '%s  %s\\n' ${shellSingleQuote(cloudflaredDigest)} "$CLOUDFLARED_PATH" | sha256sum -c -`,
    'chmod 0755 "$CLOUDFLARED_PATH"',
    'chown consuelo:consuelo "$CLOUDFLARED_PATH"',
    '',
    'write_status installing-caddy',
    `curl -fsSL ${shellSingleQuote(input.release.caddyArchiveUrl)} -o \"$CADDY_ARCHIVE\"`,
    `printf '%s  %s\\n' ${shellSingleQuote(caddyDigest)} \"$CADDY_ARCHIVE\" | sha256sum -c -`,
    'CADDY_EXTRACT_DIR="$(mktemp -d "$BOOTSTRAP_ROOT/caddy.XXXXXX")"',
    'tar -xzf "$CADDY_ARCHIVE" -C "$CADDY_EXTRACT_DIR" caddy',
    'install -m 0755 "$CADDY_EXTRACT_DIR/caddy" "$CADDY_PATH"',
    'chown consuelo:consuelo "$CADDY_PATH"',
    'rm -rf "$CADDY_EXTRACT_DIR"',
    '',
    'SYSTEMD_USER_DIR="$CONSUELO_USER_HOME/.config/systemd/user"',
    'install -d -m 0700 -o consuelo -g consuelo "$SYSTEMD_USER_DIR"',
    'cat > "$SYSTEMD_USER_DIR/consuelo-caddy.service" <<EOF',
    '[Unit]',
    'Description=Consuelo local Caddy ingress',
    'After=network-online.target',
    'Wants=network-online.target',
    '',
    '[Service]',
    'Type=simple',
    'Environment=HOME=$CONSUELO_USER_HOME',
    'Environment=CONSUELO_HOME=$CONSUELO_HOME',
    'ExecStart=$CADDY_PATH run --config $CONSUELO_HOME/node/caddy/Caddyfile --adapter caddyfile',
    'Restart=on-failure',
    'RestartSec=2',
    '',
    '[Install]',
    'WantedBy=default.target',
    'EOF',
    'chmod 0600 "$SYSTEMD_USER_DIR/consuelo-caddy.service"',
    'chown consuelo:consuelo "$SYSTEMD_USER_DIR/consuelo-caddy.service"',
    '',
    'install -d -m 0700 "$CONSUELO_HOME/bootstrap"',
    `printf '%s\\n' ${shellSingleQuote(onboarding)} > "$CONSUELO_HOME/bootstrap/onboarding.json"`,
    'chmod 0600 "$CONSUELO_HOME/bootstrap/onboarding.json"',
    'chown -R consuelo:consuelo "$CONSUELO_HOME/bootstrap"',
    '',
    'write_status activating-runtime',
    'runuser -u consuelo -- env \\',
    '  HOME="$CONSUELO_USER_HOME" \\',
    '  XDG_CONFIG_HOME="$CONSUELO_USER_HOME/.config" \\',
    '  XDG_RUNTIME_DIR="/run/user/$CONSUELO_UID" \\',
    '  DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$CONSUELO_UID/bus" \\',
    '  CONSUELO_HOME="$CONSUELO_HOME" \\',
    `  CONSUELO_RELEASE_BASE_URL=${shellSingleQuote(input.release.baseUrl)} \\`,
    `  CONSUELO_RELEASE_PUBLIC_KEYS_JSON=${shellSingleQuote(releaseKeys)} \\`,
    '  CONSUELO_RELEASE_GCP_METADATA_AUTH=1 \\',
    '  CONSUELO_MANAGED_CLOUD_NODE_ONBOARDING_FILE="$CONSUELO_HOME/bootstrap/onboarding.json" \\',
    `  "$BUN_BIN" "$BUNDLE_DIR/scripts/lifecycle.ts" install --channel ${input.release.channel} --home "$CONSUELO_HOME" --json`,
    '',
    'write_status awaiting-enrollment',
    'runuser -u consuelo -- env \\',
    '  HOME="$CONSUELO_USER_HOME" \\',
    '  XDG_CONFIG_HOME="$CONSUELO_USER_HOME/.config" \\',
    '  XDG_RUNTIME_DIR="/run/user/$CONSUELO_UID" \\',
    '  DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$CONSUELO_UID/bus" \\',
    '  systemctl --user enable --now consuelo-caddy.service',
    'if [ -f "$ENROLLMENT_STATUS_PATH" ] && jq -e \'.phase == "enrolled"\' "$ENROLLMENT_STATUS_PATH" >/dev/null 2>&1; then',
    '  write_status runtime-active enrolled',
    '  exit 0',
    'fi',
    'runuser -u consuelo -- env \\',
    '  HOME="$CONSUELO_USER_HOME" \\',
    '  XDG_CONFIG_HOME="$CONSUELO_USER_HOME/.config" \\',
    '  XDG_RUNTIME_DIR="/run/user/$CONSUELO_UID" \\',
    '  DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$CONSUELO_UID/bus" \\',
    '  CONSUELO_HOME="$CONSUELO_HOME" \\',
    '  "$BUN_BIN" "$CONSUELO_HOME/runtime/current/scripts/managed-cloud-node-enroll.ts" \\',
    '    --home "$CONSUELO_HOME" \\',
    '    --onboarding "$CONSUELO_HOME/bootstrap/onboarding.json" \\',
    '    --status "$ENROLLMENT_STATUS_PATH" \\',
    '    > "$CONSUELO_HOME/bootstrap/enrollment.log" 2>&1',
    'write_status runtime-active enrolled',
    '',
  ].join('\n');
};

export const planManagedCloudNode = (input: {
  projectId: string;
  workspaceId: string;
  workspaceSlug: string;
  workspaceHost: string;
  nodeId: string;
  nodeName: string;
  region?: string;
  zone?: string;
  machineType?: string;
  release: ManagedCloudNodeReleaseBootstrap;
}): ManagedCloudNodePlan => {
  const projectId = requireNonEmpty(input.projectId, 'projectId');
  const workspaceId = requireNonEmpty(input.workspaceId, 'workspaceId');
  const workspaceSlug = normalizeResourceLabel(
    input.workspaceSlug,
    'workspaceSlug',
  );
  const workspaceHost = canonicalWorkspaceHost(input.workspaceHost);
  const nodeId = requireNonEmpty(input.nodeId, 'nodeId');
  const resourceNodeId = normalizeResourceLabel(nodeId, 'nodeId');
  const nodeName = requireNonEmpty(input.nodeName, 'nodeName');
  const region = input.region?.trim() || 'us-east1';
  const zone = input.zone?.trim() || `${region}-b`;
  if (!zone.startsWith(`${region}-`)) {
    throw new ManagedCloudNodeError(
      'MANAGED_NODE_INPUT_INVALID',
      `zone ${zone} is not in region ${region}`,
    );
  }
  const releaseLocation = trustedGcsUrl(
    input.release.baseUrl,
    'release.baseUrl',
  );
  const bootstrapLocation = trustedGcsUrl(
    input.release.bootstrapBundleUrl,
    'release.bootstrapBundleUrl',
  );
  if (bootstrapLocation.bucket !== releaseLocation.bucket) {
    throw new ManagedCloudNodeError(
      'MANAGED_NODE_INPUT_INVALID',
      'release bootstrap bundle must use the configured release bucket',
    );
  }
  const release: ManagedCloudNodeReleaseBootstrap = {
    channel: requireReleaseChannel(input.release.channel),
    baseUrl: releaseLocation.url,
    bootstrapBundleUrl: bootstrapLocation.url,
    bootstrapBundleDigest: requireSha256(
      input.release.bootstrapBundleDigest,
      'release.bootstrapBundleDigest',
    ),
    bootstrapBundleId: requireSha256(
      input.release.bootstrapBundleId,
      'release.bootstrapBundleId',
    ),
    bootstrapBundleVersion: requireNonEmpty(
      input.release.bootstrapBundleVersion,
      'release.bootstrapBundleVersion',
    ),
    cloudflaredBinaryUrl: requireHttpsUrl(
      input.release.cloudflaredBinaryUrl,
      'release.cloudflaredBinaryUrl',
    ),
    cloudflaredBinaryDigest: requireSha256(
      input.release.cloudflaredBinaryDigest,
      'release.cloudflaredBinaryDigest',
    ),
    cloudflaredVersion: requireNonEmpty(
      input.release.cloudflaredVersion,
      'release.cloudflaredVersion',
    ),
    caddyArchiveUrl: requireHttpsUrl(
      input.release.caddyArchiveUrl,
      'release.caddyArchiveUrl',
    ),
    caddyArchiveDigest: requireSha256(
      input.release.caddyArchiveDigest,
      'release.caddyArchiveDigest',
    ),
    caddyVersion: requireNonEmpty(
      input.release.caddyVersion,
      'release.caddyVersion',
    ),
    trustedPublicKeys: Object.fromEntries(
      Object.entries(input.release.trustedPublicKeys)
        .map(([key, value]) => [key.trim(), value.trim()] as const)
        .filter(([key, value]) => key && value),
    ),
  };
  for (const [keyId, publicKey] of Object.entries(release.trustedPublicKeys)) {
    if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/i.test(publicKey)) {
      throw new ManagedCloudNodeError(
        'MANAGED_NODE_INPUT_INVALID',
        'release.trustedPublicKeys must not contain private key material: ' +
          keyId,
      );
    }
  }
  if (Object.keys(release.trustedPublicKeys).length === 0) {
    throw new ManagedCloudNodeError(
      'MANAGED_NODE_INPUT_INVALID',
      'release.trustedPublicKeys must contain at least one key',
    );
  }

  const instanceName = `consuelo-${resourceNodeId}`
    .slice(0, 63)
    .replace(/-+$/g, '');
  const dataDiskName = `${instanceName}-data`.slice(0, 63).replace(/-+$/g, '');
  const labels = {
    'consuelo-managed': 'true',
    'consuelo-environment': 'development',
    'consuelo-product': 'os-cloud',
    'consuelo-node-id': resourceNodeId,
    'consuelo-workspace-id': normalizeResourceLabel(workspaceId, 'workspaceId'),
  };
  const home = '/var/lib/consuelo';
  const statusPath = `${home}/bootstrap/status.json`;
  const enrollmentStatusPath = `${home}/bootstrap/enrollment-status.json`;
  const dataDisk: ManagedCloudNodeDataDisk = {
    name: dataDiskName,
    sizeGb: 100,
    type: 'pd-balanced',
    deviceName: 'consuelo-data',
    autoDelete: false,
    snapshotPolicies: ['consuelo-os-data-daily-90d'],
  };
  const instance: ManagedCloudNodeInstance = {
    name: instanceName,
    machineType: input.machineType?.trim() || 'e2-standard-2',
    network: 'consuelo-os-cloud',
    subnet: `consuelo-os-cloud-${region}`,
    noExternalIp: true,
    serviceAccountEmail: `consuelo-os-node@${projectId}.iam.gserviceaccount.com`,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    tags: ['consuelo-os-cloud-admin', 'consuelo-os-cloud-node'],
    bootDisk: {
      sizeGb: 30,
      type: 'pd-balanced',
      imageFamily: 'debian-12',
      imageProject: 'debian-cloud',
      autoDelete: true,
    },
    dataDisk: {
      name: dataDisk.name,
      deviceName: dataDisk.deviceName,
      autoDelete: false,
    },
    shielded: {
      secureBoot: true,
      vTPM: true,
      integrityMonitoring: true,
    },
    metadata: {
      'enable-oslogin': 'TRUE',
      'block-project-ssh-keys': 'TRUE',
      'serial-port-enable': 'TRUE',
    },
  };
  const startupScript = renderManagedCloudNodeStartupScript({
    projectId,
    workspaceId,
    workspaceSlug,
    workspaceHost,
    nodeId,
    nodeName,
    release,
    home,
    statusPath,
    enrollmentStatusPath,
  });

  return {
    provider: 'gcp',
    projectId,
    workspaceId,
    workspaceSlug,
    workspaceHost,
    nodeId,
    nodeName,
    region,
    zone,
    labels,
    release,
    releaseBucket: releaseLocation.bucket,
    dataDisk,
    instance: {
      ...instance,
      metadata: {
        ...instance.metadata,
        'startup-script': startupScript,
      },
    },
    bootstrap: {
      home,
      mountPath: home,
      statusPath,
      enrollmentStatusPath,
      startupScript,
    },
  };
};

const plannedManagedNodeOperations = (
  plan: ManagedCloudNodePlan,
): ManagedCloudNodeOperation[] => [
  { resource: `data-disk:${plan.dataDisk.name}`, status: 'planned' },
  ...plan.dataDisk.snapshotPolicies.map((policy) => ({
    resource: `snapshot-policy-attachment:${plan.dataDisk.name}:${policy}`,
    status: 'planned' as const,
  })),
  { resource: `release-bucket:${plan.releaseBucket}`, status: 'planned' },
  { resource: `instance:${plan.instance.name}`, status: 'planned' },
];

export const applyManagedCloudNode = async (input: {
  client: ManagedCloudNodeClient;
  plan: ManagedCloudNodePlan;
  dryRun?: boolean;
}): Promise<{
  status: 'planned' | 'provisioned';
  operations: ManagedCloudNodeOperation[];
}> => {
  if (input.dryRun) {
    return {
      status: 'planned',
      operations: plannedManagedNodeOperations(input.plan),
    };
  }
  const operations: ManagedCloudNodeOperation[] = [];
  const record = async (
    resource: string,
    operation: () => Promise<FoundationResourceStatus>,
  ): Promise<FoundationResourceStatus> => {
    try {
      const status = await operation();
      operations.push({ resource, status });
      return status;
    } catch (error: unknown) {
      throw new ManagedCloudNodeError(
        'MANAGED_NODE_PROVISION_FAILED',
        `managed cloud node provisioning failed at ${resource}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { cause: error },
      );
    }
  };

  const dataDiskStatus = await record(
    `data-disk:${input.plan.dataDisk.name}`,
    () =>
      input.client.ensureDataDisk({
        ...input.plan.dataDisk,
        projectId: input.plan.projectId,
        zone: input.plan.zone,
        labels: input.plan.labels,
      }),
  );
  for (const policyName of input.plan.dataDisk.snapshotPolicies) {
    await record(
      `snapshot-policy-attachment:${input.plan.dataDisk.name}:${policyName}`,
      () =>
        input.client.ensureSnapshotPolicyAttachment({
          projectId: input.plan.projectId,
          zone: input.plan.zone,
          diskName: input.plan.dataDisk.name,
          policyName,
        }),
    );
  }
  await record(`release-bucket:${input.plan.releaseBucket}`, () =>
    input.client.ensureReleaseBucketAccess({
      bucketName: input.plan.releaseBucket,
      member: `serviceAccount:${input.plan.instance.serviceAccountEmail}`,
      role: 'roles/storage.objectViewer',
    }),
  );
  const startupScript = input.plan.instance.metadata['startup-script'];
  const instance = {
    ...input.plan.instance,
    metadata: {
      ...input.plan.instance.metadata,
      ...(startupScript
        ? {
            'startup-script': startupScript.replace(
              "ALLOW_DATA_DISK_FORMAT='false'",
              `ALLOW_DATA_DISK_FORMAT='${
                dataDiskStatus === 'created' ? 'true' : 'false'
              }'`,
            ),
          }
        : {}),
    },
  };
  await record(`instance:${instance.name}`, () =>
    input.client.ensureInstance({
      ...instance,
      projectId: input.plan.projectId,
      zone: input.plan.zone,
      labels: input.plan.labels,
    }),
  );
  return { status: 'provisioned', operations };
};

export const planManagedCloudNodeReplacement = (input: {
  plan: ManagedCloudNodePlan;
}): {
  deleteInstance: true;
  deleteBootDisk: true;
  preserveDataDisk: true;
  attachDataDisk: string;
  recreateInstance: string;
} => ({
  deleteInstance: true,
  deleteBootDisk: true,
  preserveDataDisk: true,
  attachDataDisk: input.plan.dataDisk.name,
  recreateInstance: input.plan.instance.name,
});

export const planManagedCloudNodeDeletion = (input: {
  plan: ManagedCloudNodePlan;
  deleteData?: boolean;
  confirmation?: string;
}): {
  deleteInstance: true;
  deleteBootDisk: true;
  deleteDataDisk: boolean;
  dataDiskName: string;
} => {
  if (
    input.deleteData &&
    input.confirmation !== PERMANENT_DATA_DELETE_CONFIRMATION
  ) {
    throw new ManagedCloudNodeError(
      'MANAGED_NODE_PERMANENT_DELETE_CONFIRMATION_REQUIRED',
      'permanent data deletion requires explicit confirmation',
    );
  }
  return {
    deleteInstance: true,
    deleteBootDisk: true,
    deleteDataDisk: Boolean(input.deleteData),
    dataDiskName: input.plan.dataDisk.name,
  };
};

export const planManagedCloudNodeFoundation = (input: {
  projectId: string;
  billingAccountId: string;
  region?: string;
  budgetAmountUsd?: number;
}): ManagedCloudNodeFoundationPlan => {
  const projectId = requireNonEmpty(input.projectId, 'projectId');
  const billingAccountId = requireNonEmpty(
    input.billingAccountId,
    'billingAccountId',
  );
  const region = input.region?.trim() || 'us-east1';
  const subnetCidr = SUBNET_CIDRS[region];
  if (!subnetCidr) {
    throw new ManagedCloudNodeError(
      'MANAGED_NODE_INPUT_INVALID',
      'unsupported managed cloud region: ' + region,
    );
  }
  const budgetAmountUsd = input.budgetAmountUsd ?? 100;
  if (!Number.isFinite(budgetAmountUsd) || budgetAmountUsd <= 0) {
    throw new ManagedCloudNodeError(
      'MANAGED_NODE_INPUT_INVALID',
      'budgetAmountUsd must be greater than zero',
    );
  }

  const labels = {
    'consuelo-managed': 'true',
    'consuelo-environment': 'development',
    'consuelo-product': 'os-cloud',
  };

  return {
    provider: 'gcp',
    projectId,
    billingAccountId,
    region,
    labels,
    services: [...DEFAULT_SERVICES],
    network: { name: 'consuelo-os-cloud' },
    subnet: {
      name: `consuelo-os-cloud-${region}`,
      cidr: subnetCidr,
    },
    router: {
      name: `consuelo-os-cloud-${region}-router`,
      asn: 64_514,
    },
    nat: {
      name: `consuelo-os-cloud-${region}-nat`,
      router: `consuelo-os-cloud-${region}-router`,
      sourceSubnetworkIpRangesToNat: 'ALL_SUBNETWORKS_ALL_IP_RANGES',
      autoAllocateExternalIps: true,
      logging: { enabled: true, filter: 'ERRORS_ONLY' },
    },
    firewallRules: [
      {
        name: 'consuelo-os-cloud-allow-iap-ssh',
        sourceRanges: ['35.235.240.0/20'],
        targetTags: ['consuelo-os-cloud-admin'],
        allowed: ['tcp:22'],
      },
    ],
    serviceAccount: {
      accountId: 'consuelo-os-node',
      displayName: 'Consuelo OS managed cloud node',
      roles: ['roles/logging.logWriter', 'roles/monitoring.metricWriter'],
    },
    snapshotPolicies: [
      {
        name: 'consuelo-os-data-daily-90d',
        frequency: 'daily',
        startTime: '07:00',
        retentionDays: 90,
        keepAfterDiskDelete: true,
      },
      {
        name: 'consuelo-os-data-weekly-1y',
        frequency: 'weekly',
        weekday: 'sunday',
        startTime: '08:00',
        retentionDays: 365,
        keepAfterDiskDelete: true,
      },
    ],
    budget: {
      displayName: 'Consuelo Cloud Dev monthly budget',
      amountUsd: budgetAmountUsd,
      thresholdPercents: [0.5, 0.8, 1],
    },
  };
};

const plannedOperations = (
  plan: ManagedCloudNodeFoundationPlan,
): ManagedCloudNodeFoundationOperation[] => [
  ...plan.services.map((service) => ({
    resource: `service:${service}`,
    status: 'planned' as const,
  })),
  { resource: `network:${plan.network.name}`, status: 'planned' },
  { resource: `subnet:${plan.subnet.name}`, status: 'planned' },
  { resource: `router:${plan.router.name}`, status: 'planned' },
  { resource: `nat:${plan.nat.name}`, status: 'planned' },
  ...plan.firewallRules.map((rule) => ({
    resource: `firewall:${rule.name}`,
    status: 'planned' as const,
  })),
  {
    resource: `service-account:${plan.serviceAccount.accountId}`,
    status: 'planned',
  },
  ...plan.serviceAccount.roles.map((role) => ({
    resource: `iam:${role}`,
    status: 'planned' as const,
  })),
  ...plan.snapshotPolicies.map((policy) => ({
    resource: `snapshot-policy:${policy.name}`,
    status: 'planned' as const,
  })),
  { resource: `budget:${plan.budget.displayName}`, status: 'planned' },
];

export const applyManagedCloudNodeFoundation = async (input: {
  client: ManagedCloudNodeFoundationClient;
  plan: ManagedCloudNodeFoundationPlan;
  dryRun?: boolean;
}): Promise<{
  status: 'planned' | 'provisioned';
  operations: ManagedCloudNodeFoundationOperation[];
}> => {
  if (input.dryRun) {
    return { status: 'planned', operations: plannedOperations(input.plan) };
  }

  const operations: ManagedCloudNodeFoundationOperation[] = [];
  const record = async (
    resource: string,
    operation: () => Promise<FoundationResourceStatus>,
  ): Promise<void> => {
    try {
      operations.push({ resource, status: await operation() });
    } catch (error: unknown) {
      throw new ManagedCloudNodeError(
        'MANAGED_NODE_FOUNDATION_FAILED',
        `managed cloud node foundation failed at ${resource}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { cause: error },
      );
    }
  };

  for (const service of input.plan.services) {
    await record(`service:${service}`, () =>
      input.client.ensureService(service),
    );
  }
  await record(`network:${input.plan.network.name}`, () =>
    input.client.ensureNetwork({
      name: input.plan.network.name,
      projectId: input.plan.projectId,
    }),
  );
  await record(`subnet:${input.plan.subnet.name}`, () =>
    input.client.ensureSubnet({
      name: input.plan.subnet.name,
      projectId: input.plan.projectId,
      network: input.plan.network.name,
      region: input.plan.region,
      cidr: input.plan.subnet.cidr,
    }),
  );
  await record(`router:${input.plan.router.name}`, () =>
    input.client.ensureRouter({
      name: input.plan.router.name,
      projectId: input.plan.projectId,
      region: input.plan.region,
      network: input.plan.network.name,
      asn: input.plan.router.asn,
    }),
  );
  await record(`nat:${input.plan.nat.name}`, () =>
    input.client.ensureNat({
      name: input.plan.nat.name,
      projectId: input.plan.projectId,
      region: input.plan.region,
      router: input.plan.nat.router,
      sourceSubnetworkIpRangesToNat:
        input.plan.nat.sourceSubnetworkIpRangesToNat,
      autoAllocateExternalIps: input.plan.nat.autoAllocateExternalIps,
      logging: input.plan.nat.logging,
    }),
  );
  for (const rule of input.plan.firewallRules) {
    await record(`firewall:${rule.name}`, () =>
      input.client.ensureFirewallRule({
        ...rule,
        projectId: input.plan.projectId,
        network: input.plan.network.name,
      }),
    );
  }
  await record(`service-account:${input.plan.serviceAccount.accountId}`, () =>
    input.client.ensureServiceAccount({
      accountId: input.plan.serviceAccount.accountId,
      displayName: input.plan.serviceAccount.displayName,
      projectId: input.plan.projectId,
    }),
  );
  const serviceAccountMember = `serviceAccount:${input.plan.serviceAccount.accountId}@${input.plan.projectId}.iam.gserviceaccount.com`;
  for (const role of input.plan.serviceAccount.roles) {
    await record(`iam:${role}`, () =>
      input.client.ensureProjectRoleBinding({
        member: serviceAccountMember,
        projectId: input.plan.projectId,
        role,
      }),
    );
  }
  for (const policy of input.plan.snapshotPolicies) {
    await record(`snapshot-policy:${policy.name}`, () =>
      input.client.ensureSnapshotPolicy({
        ...policy,
        projectId: input.plan.projectId,
        region: input.plan.region,
        labels: input.plan.labels,
      }),
    );
  }
  await record(`budget:${input.plan.budget.displayName}`, () =>
    input.client.ensureBudget({
      billingAccountId: input.plan.billingAccountId,
      displayName: input.plan.budget.displayName,
      projectId: input.plan.projectId,
      amountUsd: input.plan.budget.amountUsd,
      thresholdPercents: input.plan.budget.thresholdPercents,
    }),
  );

  return { status: 'provisioned', operations };
};

export const waitForManagedCloudOperation = async (input: {
  operationId: string;
  getOperation: (operationId: string) => Promise<{
    status: 'pending' | 'done';
    error?: { code: string; message: string };
  }>;
  sleep: (milliseconds: number) => Promise<void>;
  intervalMs?: number;
  timeoutMs?: number;
}): Promise<{ status: 'done' }> => {
  const intervalMs = input.intervalMs ?? 1_000;
  const timeoutMs = input.timeoutMs ?? 120_000;
  let elapsedMs = 0;

  while (elapsedMs <= timeoutMs) {
    let operation: Awaited<ReturnType<typeof input.getOperation>>;
    try {
      operation = await input.getOperation(input.operationId);
    } catch (error: unknown) {
      throw new ManagedCloudNodeError(
        'MANAGED_NODE_OPERATION_READ_FAILED',
        `failed to read managed cloud operation ${input.operationId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { cause: error },
      );
    }
    if (operation.status === 'done') {
      if (operation.error) {
        throw new ManagedCloudNodeError(
          operation.error.code,
          `${operation.error.code}: ${operation.error.message}`,
        );
      }
      return { status: 'done' };
    }
    if (elapsedMs === timeoutMs) break;
    await input.sleep(intervalMs);
    elapsedMs = Math.min(timeoutMs, elapsedMs + intervalMs);
  }

  throw new ManagedCloudNodeError(
    'MANAGED_NODE_OPERATION_TIMEOUT',
    `managed cloud operation timed out: ${input.operationId}`,
  );
};
