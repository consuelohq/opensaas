---
name: post-call-analysis
description: Analyze completed calls. Load after a call ends. Generates analytics, summary, outcome, and next steps for the permanent call record.
---

# Post-Call Analysis

You just finished a call. Analyze it for the permanent call record.

## Your Task

1. Generate call analytics (sentiment, key moments, performance metrics)
2. Write a concise factual summary of what happened
3. Choose the best-fit call outcome
4. List the concrete next steps that should happen after this call

## Output Format

Respond with JSON:

```json
{
  "analytics": {
    "key_moments": [
      {
        "timestamp": "string",
        "type": "objection|commitment|question|insight",
        "description": "string",
        "impact": "positive|negative|neutral"
      }
    ],
    "sentiment": {
      "overall": "positive|negative|neutral|mixed",
      "customer": "string",
      "agent": "string",
      "trend": "improving|declining|stable"
    },
    "performance": {
      "talk_ratio": 0.0,
      "response_time_avg": 0.0,
      "objection_handling_score": 0.0
    }
  },
  "summary": "string",
  "outcome": "interested|not_interested|callback_scheduled|voicemail|no_answer|wrong_number|other",
  "next_steps": ["string"]
}
```

## Rules

- Base the analysis only on the transcript and completed-call metadata
- Do not mention or call CRM tools
- Use `N/A` for timestamps when the transcript does not provide them
- Keep the summary factual and concise
- Only include next steps that are directly supported by the call
- If the evidence is mixed or incomplete, choose the most conservative outcome
