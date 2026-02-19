# Consuelo API Postman Collections

Postman API test collections for the Consuelo (Twenty CRM fork) platform.

## Overview

This collection includes comprehensive API tests organized into 6 folders:

| Folder          | Requests | Description                                                       |
| --------------- | -------- | ----------------------------------------------------------------- |
| Auth            | 4        | signUp, signIn challenge, verify, token refresh                   |
| Voice/Dialer    | 13       | Token, TwiML, call, hold, transfer, parallel dial, caller ID lock |
| Contacts        | 9        | CRUD operations, search, import, normalize, queue                 |
| GraphQL Core    | 7        | People, companies, search, metadata                               |
| Calls+History   | 6        | Call logs, details, stats, recordings, notes                      |
| Queue+Analytics | 8        | Queue management and analytics endpoints                          |

## Importing

### 1. Import the Collection

1. Open Postman
2. Click **Import** (top-left button)
3. Select the `consuelo.postman_collection.json` file
4. The collection will appear in your sidebar

### 2. Import the Environment

1. Click the **Environments** dropdown (top-right, near the gear icon)
2. Click **Import**
3. Select the `consuelo.postman_environment.json` file
4. Select "Consuelo API" from the environment dropdown

## Configuration

### Environment Variables

Update these values in the environment before running tests:

| Variable                             | Description                     | Required |
| ------------------------------------ | ------------------------------- | -------- |
| `base_url`                           | API base URL                    | Yes      |
| `test_email`                         | Email for signup/signin         | Yes      |
| `test_password`                      | Password for signup/signin      | Yes      |
| `access_token`                       | Set automatically by Auth tests | Auto     |
| `refresh_token`                      | Set automatically by Auth tests | Auto     |
| `call_sid`, `contact_id`, `queue_id` | Set by test scripts             | Auto     |

### Base URL

Default: `https://opensaas-production.up.railway.app`

For local development, update `base_url` to your local server (e.g., `http://localhost:3000`).

## Running Tests

### Running All Tests

Right-click the collection root → **Run Collection**

### Running Specific Folders

Expand the collection, right-click a folder (e.g., "Auth") → **Run Folder**

### Running Individual Requests

Select a request and click **Send** or press `Ctrl+Enter`

## Authentication Flow

Twenty CRM uses GraphQL for authentication. The flow is:

1. **signUp** / **signIn Challenge** → Returns `loginToken`
2. **verify** → Exchange `loginToken` for `accessToken` + `refreshToken`
3. **Token Refresh** → Use `refresh_token` to get new `access_token`

The collection includes a pre-request script that auto-refreshes expired tokens.

### Running Auth Tests

1. Set `test_email` and `test_password` in the environment
2. Run the **Auth → signUp** request (or **signIn Challenge** if user exists)
3. The `loginToken` is automatically saved
4. Run **Auth → verify** to get access/refresh tokens
5. Other requests will use these tokens automatically

## API Endpoints

### Auth (GraphQL)

- `POST /` - GraphQL endpoint for signUp, signIn, verify mutations
- `POST /v1/auth/refresh` - Token refresh

### Voice/Dialer

- `GET /v1/voice/token` - Twilio access token
- `POST /v1/voice/twiml` - Conference TwiML webhook
- `POST /v1/calls` - Initiate call
- `POST /v1/calls/:callSid/hold` - Toggle hold
- `POST /v1/calls/:callSid/transfer` - Initiate transfer
- `POST /v1/calls/:callSid/transfer/complete` - Complete warm transfer
- `POST /v1/calls/:callSid/transfer/cancel` - Cancel warm transfer
- `POST /v1/dialer/parallel` - Start parallel dial
- `DELETE /v1/dialer/parallel/:sessionId` - Stop parallel dial
- `GET/POST/DELETE /v1/dialer/caller-id/lock/:callerId` - Caller ID lock management

### Contacts

- `GET/POST /v1/contacts` - List/create contacts
- `GET/PATCH/DELETE /v1/contacts/:id` - Get/update/delete contact
- `GET /v1/contacts/search` - Search contacts
- `POST /v1/contacts/import` - CSV import
- `POST /v1/contacts/normalize` - Phone normalization
- `GET /v1/contacts/queue` - Get contact queue

### GraphQL Core

All Core API operations use GraphQL at `POST /`:

- People/companies CRUD
- Search
- Field metadata
- Workspace info

### Calls+History

- `GET /v1/calls/logs` - Call log
- `GET /v1/calls/:callSid` - Call detail
- `GET /v1/calls/stats` - Call statistics
- `GET /v1/calls/recent` - Recent calls
- `GET /v1/calls/:callSid/recording` - Call recording
- `GET /v1/calls/:callSid/notes` - Call notes

### Queue+Analytics

- `GET/POST /v1/queues` - List/create queues
- `GET /v1/queues/:queueId/stats` - Queue statistics
- `GET /v1/analytics/summary` - Analytics summary
- `GET /v1/analytics/agents` - Agent statistics
- `GET /v1/analytics/calls/volume` - Call volume
- `GET /v1/analytics/calls/answer-rate` - Answer rate
- `GET /v1/analytics/calls/duration` - Duration statistics

## Assertions

Every request includes `pm.test()` assertions that verify:

- Status codes (200, 201, 204, etc.)
- Response structure
- Required fields in responses
- Environment variable updates

## Tips

### Test Order

Run requests in this order for best results:

1. **Auth → signUp** (or signIn Challenge)
2. **Auth → verify**
3. **Contacts → Create Contact** (sets `contact_id`)
4. **Voice/Dialer → Initiate Call** (sets `call_sid`)
5. **Queue+Analytics → Create Queue** (sets `queue_id`)

### Debugging

Check the **Tests** tab in the response panel to see assertion results.

Use `console.log()` in pre-request scripts - output appears in the Postman console (`View → Show Postman Console`).

### Token Issues

If you get 401 errors:

1. Run **Auth → verify** to refresh tokens
2. Check that `access_token` is set in the environment
3. Verify `token_expiry` hasn't passed (30 minutes from token grant)
