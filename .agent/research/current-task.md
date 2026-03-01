# Task Research: Backend - Track Detailed Twilio Call Outcomes (#703)

## Current Implementation Analysis

### Call Result Storage Structure (MongoDB)
Current `CallQueueResult` stored in `call_queues.results[]` array:
```python
{
    "number": str,               # Phone number called
    "status": str,               # completed/failed/timeout/error/no_answer
    "call_sid": str,             # Twilio call SID
    "timestamp": str,            # ISO format
    "duration": int,             # Call duration in seconds
    "error": str                 # Error message if failed
}
```

**Location in code**: `app/script.py:18542-18598` (atomic $push to results array)

### Frontend Call Disposition Mapping
Frontend (`src/components/BrowserAudioSession.tsx:674-807`) creates call results with these dispositions:
- `answered` → status: `completed`
- `no-answer` → status: `no_answer`
- `busy` → status: `no_answer`
- `voicemail` → status: `completed` (AMD detected)
- `failed` → status: `failed`

### Twilio Webhook Handlers

**1. `/call_status` webhook** (`app/script.py:6965-7180`)
- Receives: `CallStatus` field from Twilio
- Values: `completed`, `no-answer`, `busy`, `failed`, `canceled`
- Currently: Updates call record in `calls_collection`, releases caller ID lock
- Does NOT update queue results

**2. `/dial_status` webhook** (`app/script.py:5662-5759`)
- Receives: `DialCallStatus` field from Twilio
- Receives: `AnsweredBy` field (AMD result)
- AMD values: `human`, `machine_start`, `machine_end_beep`, `machine_end_silence`, `machine_end_other`, `fax`, `unknown`
- Currently: Handles voicemail auto-hangup for queue calls (lines 5687-5726)
- Location: Updates `calls_collection` with voicemail status, does NOT update queue results

**3. `/api/twilio/voice/status` webhook** (`app/script.py:6550-6700`)
- Browser calling status callback
- Receives: `DialCallStatus`, `DialCallDuration`
- Currently: Updates call record, tracks usage/billing
- Does NOT update queue results

**4. AMD Status Callback** (`app/script.py:7333-7542`)
- Endpoint: `/api/voice/amd-status-callback`
- Receives: `AnsweredBy` field
- Currently: Stores in Redis, tracks analytics, terminates voicemail calls
- Does NOT update queue results

### Queue Result Update Flow

**Current flow (Browser calling):**
1. Frontend `BrowserAudioSession.tsx` determines disposition from call state
2. Frontend calls `updateQueueProgress()` API with `call_result` object
3. Backend `/api/queues/update-progress` endpoint receives result
4. Backend atomically pushes to `call_queues.results[]` array

**Issue:** Backend webhooks do NOT update queue results - only frontend does

## Implementation Plan

### Recommended Approach: Update Backend Webhooks + Frontend
Hybrid approach for best coverage:
1. Backend webhook adds `call_outcome` when it fires (authoritative)
2. Frontend also adds `call_outcome` when creating result (immediate)
3. Backend webhook overwrites frontend value if different (Twilio is source of truth)

**Why both:**
- Frontend provides immediate feedback (no waiting for webhook)
- Backend provides accurate status from Twilio
- Backend handles phone calling mode (no frontend involvement)

### Status Mapping Logic
```python
def map_call_outcome(call_status: str, answered_by: str = None) -> str:
    """
    Map Twilio CallStatus + AnsweredBy to call_outcome.

    Returns: 'answered' | 'no_answer' | 'busy' | 'voicemail' | 'failed'
    """
    voicemail_indicators = ['machine_start', 'machine_end_beep',
                           'machine_end_silence', 'machine_end_other', 'fax']

    # Voicemail detected by AMD (takes precedence)
    if answered_by in voicemail_indicators:
        return 'voicemail'

    # Map Twilio status to outcome
    if call_status == 'completed':
        return 'answered'  # Completed + human detected (or AMD not enabled)
    elif call_status == 'no-answer':
        return 'no_answer'
    elif call_status == 'busy':
        return 'busy'
    elif call_status in ['failed', 'canceled']:
        return 'failed'
    else:
        return 'failed'  # Default for unknown statuses
```

## Implementation Details

### 1. Files to Modify

**`app/script.py`:**
- Function: `handle_normal_status_callback()` (line ~7108)
- Add logic to update queue results with `call_outcome` field

**`src/components/BrowserAudioSession.tsx`:**
- Lines 794-807: Add `call_outcome` field to callDisposition object

### 2. Backend Webhook Update Strategy

Add to `handle_normal_status_callback()` after releasing caller ID lock:

```python
# Check if this is a queue call and update result with call_outcome
if calls_collection is not None:
    call_record = calls_collection.find_one({"call_sid": call_sid})
    if call_record and call_record.get('queue_id'):
        queue_id = call_record['queue_id']
        answered_by = call_record.get('amd_result') or call_record.get('answered_by')
        call_outcome = map_call_outcome(call_status, answered_by)
        
        # Update existing result with call_outcome (Twilio is source of truth)
        if call_queues_collection is not None:
            update_result = call_queues_collection.update_one(
                {
                    'queue_id': queue_id,
                    'results.call_sid': call_sid
                },
                {
                    '$set': {
                        'results.$.call_outcome': call_outcome
                    }
                }
            )
            
            if update_result.matched_count > 0:
                log_info("[CALL STATUS] Updated queue result with call_outcome",
                        call_sid=call_sid,
                        queue_id=queue_id,
                        call_outcome=call_outcome)
```

### 3. Frontend Update Strategy

Update `BrowserAudioSession.tsx` line ~794-807:

```typescript
const callDisposition = {
  number: customerNumber,
  status: statusMap[disposition] || 'completed',
  call_outcome: disposition,  // NEW: Add call_outcome field
  timestamp: new Date().toISOString(),
  duration: duration
};
```

### 4. MongoDB Schema

New field added to existing structure:
```python
CallQueueResult = {
    "number": str,
    "status": str,           # Keep existing: completed/failed/timeout/no_answer
    "call_outcome": str,     # NEW: answered/no_answer/busy/voicemail/failed
    "call_sid": str,
    "timestamp": str,
    "duration": int,
    "error": str
}
```

## Edge Cases Handled

1. **AMD callback timing**: AMD stores result in call record's `amd_result` field, webhook reads it
2. **Missing AMD data**: Falls back to mapping CallStatus only (completed → answered)
3. **Phone calling mode**: Backend webhook handles entirely (no frontend)
4. **Browser calling mode**: Frontend adds immediately, backend overwrites with authoritative value
5. **Backward compatibility**: Existing `status` field unchanged, new `call_outcome` field optional

## Testing Checklist

- [ ] Browser calling: voicemail detected → `call_outcome: 'voicemail'`
- [ ] Browser calling: call answered → `call_outcome: 'answered'`
- [ ] Browser calling: no answer → `call_outcome: 'no_answer'`
- [ ] Browser calling: busy signal → `call_outcome: 'busy'`
- [ ] Browser calling: call failed → `call_outcome: 'failed'`
- [ ] Phone calling: all statuses tracked correctly
- [ ] Backward compatibility: existing queues still work
- [ ] `status` field still present and unchanged
