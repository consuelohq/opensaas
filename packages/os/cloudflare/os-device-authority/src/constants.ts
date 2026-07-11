export const ORIGIN = 'https://os.consuelohq.com';
export const TTL_MS = 15 * 60 * 1000;
export const BOOTSTRAP_TTL_MS = 10 * 60 * 1000;
export const INTERVAL = 5;
export const GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:device_code';
export const WORKSPACE_ROUTE_SETUP_FAILURE_CODE =
  'workspace_route_setup_failed' as const;
export const TOKEN_KEY = 'access' + '_token';
export const CONNECTOR_TOKEN_KEY = 'connector_bootstrap' + '_token';
export const CLOUDFLARE_TUNNEL_TOKEN_KEY = 'cloudflare_tunnel' + '_token';
export const AUTH_ASSERTION_HEADER = 'x-consuelo-account-assertion';
export const DEVICE_PROOF_PAYLOAD_KEY = 'device_public_key_proof_payload';
export const DEVICE_PROOF_KEY = 'device_public_key_proof';
export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';
export const GOOGLE_SCOPE = 'openid email profile';
export const ALLOWED_AUTH_METHODS = [
  'google',
  'passkey',
  'magic_link',
  'hardware_key',
  'admin_invite',
] as const;
export const ALLOWED_AUTH_METHOD_SET = new Set<string>(ALLOWED_AUTH_METHODS);
export const REJECTED_AUTH_METHODS = new Set<string>([
  'password',
  'username_password',
  'basic',
  'basic_auth',
]);
export const DEFAULT_SITE_SNAPSHOT_KEY =
  'sites/workspace_testing/launcher/sha256-15c3f6f5c611b43c/index.html';
export const DEFAULT_SITE_SNAPSHOT_VERSION_ID = 'sha256-15c3f6f5c611b43c';
export const DEFAULT_SITE_ID = 'launcher';
export const DEFAULT_SITE_CONTENT_TYPE = 'text/html; charset=utf-8';
export const DEFAULT_CONNECTOR_LOCAL_SERVICE_URL = 'http://127.0.0.1:46321';
export const CHATGPT_OAUTH_CLIENT_ID = 'chatgpt-consuelo-os';
export const CHATGPT_REDIRECT_PREFIX = 'https://chatgpt.com/connector/oauth/';
export const MCP_OAUTH_TTL_MS = 60 * 60 * 1000;
export const MCP_OAUTH_CODE_TTL_MS = 5 * 60 * 1000;
export const MCP_OAUTH_SCOPES = [
  'mcp:read',
  'mcp:call',
  'workspace:read',
  'os:tools',
  'route:/mcp:read',
  'tool:*:read',
];
