# @consuelo/coaching

> **⚠️ DEPRECATED:** This package is deprecated. Coaching is now a pi skill in `@consuelo/agent`.
> See DEV-1254 (Pi Agent Runtime Integration) for details.
>
> - Coaching schemas → `@consuelo/agent` (`createCoachingSchemas`, `SalesCoaching`, `CallAnalytics`, etc.)
> - Real-time coaching → `createCoachingDetector` extension in `@consuelo/agent`
> - Post-call analysis → `createCoachingLifecycle` extension in `@consuelo/agent`
> - Model cycling → `ModelCyclingConfig` in `@consuelo/agent`

AI-powered sales coaching with structured outputs via Groq/OpenAI.

## Migration

```typescript
// Before (deprecated)
import { Coach } from '@consuelo/coaching';
const coach = new Coach({ apiKey: '...' });
const tips = await coach.coach(transcript);

// After — coaching is handled by the pi agent with skills
import { createCoachingDetector, createCoachingLifecycle } from '@consuelo/agent';
```
