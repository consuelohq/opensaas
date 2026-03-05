// Common test fixtures for API route tests
// Phone numbers, call SIDs, conference names, user IDs

export const fixtures = {
  // phone numbers (E.164 format)
  phoneNumbers: {
    agent: '+15559876543',
    customer: '+15551234567',
    transfer: '+15555678901',
    invalid: '555-bad',
    international: '+442071234567',
  },

  // twilio resource SIDs
  callSids: {
    agent: 'CA-agent-001',
    customer: 'CA-customer-001',
    transfer: 'CA-transfer-001',
  },

  conferenceSids: {
    active: 'CF-active-001',
    completed: 'CF-completed-001',
  },

  conferenceNames: {
    active: 'conf-abc123',
    completed: 'conf-def456',
  },

  // user/workspace identifiers
  users: {
    agent: {
      userId: 'user-agent-001',
      workspaceId: 'ws-001',
      workspaceMemberId: 'wm-001',
      userWorkspaceId: 'uws-001',
    },
    admin: {
      userId: 'user-admin-001',
      workspaceId: 'ws-001',
      workspaceMemberId: 'wm-002',
      userWorkspaceId: 'uws-002',
    },
  },

  // parallel dialing
  parallel: {
    groupId: 'pg-test-001',
    queueId: 'queue-test-001',
    customerNumbers: ['+15551111111', '+15552222222', '+15553333333'],
    fromNumbers: ['+15559991111', '+15559992222', '+15559993333'],
  },

  // twilio config
  twilio: {
    accountSid: 'AC-test-account',
    authToken: 'test-auth-token',
    twimlAppSid: 'AP-test-twiml',
    apiKey: 'SK-test-key',
    apiSecret: 'test-api-secret',
  },
} as const;
