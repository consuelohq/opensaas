import {
  BadRequestException,
  Injectable,
  NotImplementedException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';

import { DataSource } from 'typeorm';

const E164_REGEX = /^\+[1-9]\d{6,14}$/;

@Injectable()
export class CallsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async initiateCall() {
    try {
      throw new NotImplementedException(
        'DEV-1459: call initiation migration in progress',
      );
    } finally {
      // noop
    }
  }

  async callbackCall() {
    try {
      throw new NotImplementedException(
        'DEV-1459: callback call migration in progress',
      );
    } finally {
      // noop
    }
  }

  async callbackTwiml() {
    try {
      throw new NotImplementedException(
        'DEV-1459: callback TwiML migration in progress',
      );
    } finally {
      // noop
    }
  }

  async initiatePhoneCall(workspaceId: string, body: Record<string, unknown>) {
    try {
      const repPhone = String(body.repPhone ?? '').trim();
      const leadPhone = String(body.leadPhone ?? '').trim();
      const contactId = body.contactId ? String(body.contactId) : null;
      const callerId = String(
        body.from ??
          process.env.TWILIO_PHONE_NUMBER ??
          process.env.TWILIO_CALLER_ID ??
          '',
      ).trim();

      if (!repPhone || !leadPhone) {
        throw new BadRequestException('Missing repPhone or leadPhone');
      }

      if (!E164_REGEX.test(repPhone) || !E164_REGEX.test(leadPhone)) {
        throw new BadRequestException('Phone numbers must be E.164 format');
      }

      if (!callerId || !E164_REGEX.test(callerId)) {
        throw new BadRequestException(
          'from must be a valid E.164 phone number',
        );
      }

      const twilio = (await import('twilio')).default;
      const client = twilio(
        process.env.TWILIO_ACCOUNT_SID ?? '',
        process.env.TWILIO_AUTH_TOKEN ?? '',
      );
      const call = await client.calls.create({
        to: leadPhone,
        from: callerId,
      });

      const rows = await this.dataSource.query(
        'INSERT INTO calls (workspace_id, call_sid, contact_id, direction, status, "from", "to", start_time, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), NOW()) RETURNING id, call_sid, status',
        [
          workspaceId,
          call.sid,
          contactId,
          'outbound',
          'initiated',
          callerId,
          leadPhone,
        ],
      );

      return {
        callId: rows[0]?.id ?? null,
        callSid: call.sid,
        status: rows[0]?.status ?? 'initiated',
      };
    } finally {
      // noop
    }
  }

  async getCallHistory(workspaceId: string, limit: number, offset: number) {
    try {
      const rows = await this.dataSource.query(
        'SELECT c.*, ct.name AS contact_name, ct.company AS contact_company FROM calls c LEFT JOIN contacts ct ON c.contact_id = ct.id WHERE c.workspace_id = $1 ORDER BY c.created_at DESC LIMIT $2 OFFSET $3',
        [workspaceId, limit, offset],
      );
      const totalRows = await this.dataSource.query(
        'SELECT COUNT(*)::int AS total FROM calls c WHERE c.workspace_id = $1',
        [workspaceId],
      );

      return {
        data: rows,
        total: totalRows[0]?.total ?? 0,
        limit,
        offset,
      };
    } finally {
      // noop
    }
  }

  async streamRecording() {
    try {
      throw new NotImplementedException(
        'DEV-1459: recording stream migration in progress',
      );
    } finally {
      // noop
    }
  }

  async getCall(workspaceId: string, id: string) {
    try {
      const rows = await this.dataSource.query(
        'SELECT c.*, ct.name AS contact_name, ct.company AS contact_company FROM calls c LEFT JOIN contacts ct ON c.contact_id = ct.id WHERE (c.id::text = $1 OR c.call_sid = $1) AND c.workspace_id = $2',
        [id, workspaceId],
      );

      return rows[0] ?? null;
    } finally {
      // noop
    }
  }

  async hangupCall() {
    try {
      throw new NotImplementedException(
        'DEV-1459: hangup migration in progress',
      );
    } finally {
      // noop
    }
  }

  async persistAnalysis(
    workspaceId: string,
    id: string,
    analysis: Record<string, unknown>,
  ) {
    try {
      const rows = await this.dataSource.query(
        'UPDATE calls SET analysis = $1, updated_at = NOW() WHERE (id::text = $2 OR call_sid = $2) AND workspace_id = $3 RETURNING id',
        [JSON.stringify(analysis), id, workspaceId],
      );

      return rows[0] ?? null;
    } finally {
      // noop
    }
  }

  async getRecording() {
    try {
      throw new NotImplementedException(
        'DEV-1459: recording lookup migration in progress',
      );
    } finally {
      // noop
    }
  }

  async setDisposition(
    workspaceId: string,
    id: string,
    outcome: string | null,
    notes?: string,
  ) {
    try {
      const rows = await this.dataSource.query(
        'UPDATE calls SET outcome = COALESCE($1, outcome), notes = COALESCE($2, notes), updated_at = NOW() WHERE (id::text = $3 OR call_sid = $3) AND workspace_id = $4 RETURNING id, outcome, notes',
        [outcome, notes ?? null, id, workspaceId],
      );

      return rows[0] ?? null;
    } finally {
      // noop
    }
  }

  async getTranscript(workspaceId: string, id: string) {
    try {
      const rows = await this.dataSource.query(
        'SELECT transcript FROM calls WHERE (id::text = $1 OR call_sid = $1) AND workspace_id = $2',
        [id, workspaceId],
      );

      return rows[0] ?? null;
    } finally {
      // noop
    }
  }
}
