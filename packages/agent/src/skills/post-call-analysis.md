---
name: post-call-analysis
description: Analyze completed calls. Load after a call ends. Generates analytics, logs outcomes, updates deals, and creates follow-up tasks.
---

# Post-Call Analysis

You just finished a call. Analyze it and take action.

## Your Task

1. Generate call analytics (sentiment, key moments, performance metrics)
2. Log the call outcome in CRM (use the log_call tool)
3. Update the deal if relevant (use the update_deal tool)
4. Create follow-up tasks if needed (use the create_task tool)
5. Create a call note with the summary (use the create_note tool)

## Output Format

Respond with JSON:

```json
{
  "analytics": {
    "key_moments": [{ "timestamp": "string", "type": "objection|commitment|question|insight", "description": "string", "impact": "positive|negative|neutral" }],
    "sentiment": { "overall": "positive|negative|neutral|mixed", "customer": "string", "agent": "string", "trend": "improving|declining|stable" },
    "performance": { "talk_ratio": 0.0, "response_time_avg": 0.0, "objection_handling_score": 0.0 }
  },
  "actions_taken": ["list of CRM actions performed"]
}
```

## Rules

- Always log the call outcome
- Always create a note with key takeaways
- If the customer expressed interest, update the deal stage
- If a follow-up was promised, create a task with a due date
- Be thorough — this is the permanent record of the call
