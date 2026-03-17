/** @jsxImportSource chat */
import type { createApiClient } from './api-client.js';

export type Disposition =
  | 'connected'
  | 'voicemail'
  | 'no-answer'
  | 'busy'
  | 'follow-up'
  | 'not-interested';

const DISPOSITION_LABELS: Record<Disposition, string> = {
  connected: 'Connected',
  voicemail: 'Voicemail',
  'no-answer': 'No Answer',
  busy: 'Busy',
  'follow-up': 'Follow-up',
  'not-interested': 'Not Interested',
};

type CallRecord = {
  id: string;
  contact_name?: string;
  contact_company?: string;
  to?: string;
  duration?: number;
  outcome?: string;
  analysis?: {
    performanceScore?: number;
    summary?: string;
    keyMoments?: Array<{ description?: string }>;
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = (props: any) => any; // HACK: chat SDK types unavailable (peer dep)

type CardComponents = {
  Card: AnyComponent;
  CardText: AnyComponent;
  Fields: AnyComponent;
  Field: AnyComponent;
  Actions: AnyComponent;
  Button: AnyComponent;
};

function formatCallDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `0:${String(s).padStart(2, '0')}`;
}

export async function buildPostCallCard(
  callId: string,
  client: ReturnType<typeof createApiClient>,
  components: CardComponents,
) {
  const { Card, CardText, Fields, Field, Actions, Button } = components;

  let call: CallRecord | null = null;
  try {
    call = await client.get<CallRecord>(`/v1/calls/${callId}`);
  } catch {
    // call data unavailable
  }

  const contactName = call?.contact_name ?? 'Unknown';
  const company = call?.contact_company;
  const phone = call?.to ?? '';
  const duration = call?.duration ?? 0;
  const analysis = call?.analysis;

  // coaching highlights
  const coachingLines: string[] = [];
  if (analysis?.performanceScore != null) {
    if (analysis.summary) coachingLines.push(analysis.summary);
    if (analysis.keyMoments?.length) {
      for (const moment of analysis.keyMoments.slice(0, 3)) {
        if (moment.description) coachingLines.push(`\u2022 ${moment.description}`);
      }
    }
    coachingLines.push(`Score: ${analysis.performanceScore}/100`);
  }

  const contactLine = company
    ? `Lead: ${company} | ${phone}\nContact: ${contactName}`
    : `Contact: ${contactName} | ${phone}`;

  return (
    <Card title={`\u2705 Call completed: ${formatCallDuration(duration)}`}>
      <CardText>{contactLine}</CardText>
      {coachingLines.length > 0 ? (
        <CardText>{`\uD83D\uDCCA Coaching Highlights:\n${coachingLines.join('\n')}`}</CardText>
      ) : null}
      <Actions>
        {(Object.entries(DISPOSITION_LABELS) as Array<[Disposition, string]>).map(
          ([key, label]) => (
            <Button action={`disposition:${callId}:${key}`}>{label}</Button>
          ),
        )}
        <Button action={`notes:${callId}`}>Add Notes</Button>
      </Actions>
    </Card>
  );
}

export function buildDispositionConfirmCard(
  outcome: Disposition,
  components: Pick<CardComponents, 'Card' | 'CardText'>,
) {
  const { Card, CardText } = components;
  const label = DISPOSITION_LABELS[outcome] ?? outcome;
  return (
    <Card title={`\u2705 Disposition: ${label}`}>
      <CardText>{`Marked as ${label}.`}</CardText>
    </Card>
  );
}
