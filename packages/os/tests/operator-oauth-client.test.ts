import { describe, expect, it } from 'vitest';

import {
  CHATGPT_OAUTH_CLIENT_ID,
  OPERATOR_OAUTH_CLIENT_ID,
} from '../cloudflare/os-device-authority/src/constants';
import {
  scopesForClient,
  validChatGptClientId,
  validChatGptRedirectUri,
  validOperatorClientId,
  validOperatorRedirectUri,
} from '../cloudflare/os-device-authority/src/utils';

describe('operator OAuth client', () => {
  describe('client id', () => {
    it('accepts the operator CLI client', () => {
      expect(validOperatorClientId(OPERATOR_OAUTH_CLIENT_ID)).toBe(true);
    });

    it.each([
      ['empty', ''],
      ['a lookalike', 'consuelo-os-operator-cli-x'],
      ['the ChatGPT client', 'chatgpt-consuelo-os'],
    ])('rejects %s', (_label, value) => {
      expect(validOperatorClientId(value)).toBe(false);
    });

    it('is not accepted by the ChatGPT client validator', () => {
      expect(validChatGptClientId(OPERATOR_OAUTH_CLIENT_ID)).toBe(false);
    });
  });

  describe('redirect uri', () => {
    it.each([
      ['IPv4 loopback', 'http://127.0.0.1:8765/callback'],
      ['IPv6 loopback', 'http://[::1]:8765/callback'],
      ['a different port', 'http://127.0.0.1:49152/cb'],
    ])('accepts %s', (_label, value) => {
      expect(validOperatorRedirectUri(value)).toBe(true);
    });

    it.each([
      ['a remote host', 'http://evil.example.com:8765/callback'],
      ['a host that merely contains localhost', 'http://localhost.evil.com:80/cb'],
      // RFC 8252 section 8.3: localhost resolves through DNS and the hosts file, so it can be
      // pointed off-loopback. Only the literals are accepted.
      ['localhost', 'http://localhost:8765/callback'],
      ['no port', 'http://127.0.0.1/callback'],
      ['port zero', 'http://127.0.0.1:0/callback'],
      ['https', 'https://127.0.0.1:8765/callback'],
      ['embedded credentials', 'http://user:pw@127.0.0.1:8765/cb'],
      ['a fragment', 'http://127.0.0.1:8765/cb#x'],
      ['a chatgpt redirect', 'https://chatgpt.com/connector/oauth/callback'],
      ['garbage', 'not-a-url'],
    ])('rejects %s', (_label, value) => {
      expect(validOperatorRedirectUri(value)).toBe(false);
    });

    it('does not accept a loopback redirect for the ChatGPT client', () => {
      expect(validChatGptRedirectUri('http://127.0.0.1:8765/callback')).toBe(
        false,
      );
    });
  });

  describe('client and redirect kinds cannot be mixed', () => {
    // The authorize handler pairs each client with its own redirect validator. These assertions pin
    // the property that makes that safe: neither validator accepts the other's redirect.
    it('operator client cannot use a chatgpt.com redirect', () => {
      expect(
        validOperatorRedirectUri('https://chatgpt.com/connector/oauth/cb'),
      ).toBe(false);
    });

    it('chatgpt client cannot use a loopback redirect', () => {
      expect(validChatGptRedirectUri('http://127.0.0.1:8765/cb')).toBe(false);
    });
  });

  describe('scopes are restricted per client', () => {
    const requested = [
      'mcp:read',
      'mcp:call',
      'os:tools',
      'workspace:nodes:manage',
    ];

    it('lets the operator client hold workspace:nodes:manage', () => {
      expect(scopesForClient(requested, OPERATOR_OAUTH_CLIENT_ID)).toContain(
        'workspace:nodes:manage',
      );
    });

    it('strips workspace:nodes:manage from the ChatGPT client', () => {
      const granted = scopesForClient(requested, CHATGPT_OAUTH_CLIENT_ID);
      expect(granted).not.toContain('workspace:nodes:manage');
      // The scopes it may legitimately hold are untouched.
      expect(granted).toEqual(['mcp:read', 'mcp:call', 'os:tools']);
    });

    it('strips operator-only scopes from an unrecognised client id', () => {
      expect(scopesForClient(requested, 'something-else')).not.toContain(
        'workspace:nodes:manage',
      );
    });
  });
});
