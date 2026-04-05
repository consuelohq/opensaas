import { Injectable, NotImplementedException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class CallsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async initiateCall() {
    throw new NotImplementedException('DEV-1459: call initiation migration in progress');
  }

  async callbackCall() {
    throw new NotImplementedException('DEV-1459: callback call migration in progress');
  }

  async callbackTwiml() {
    throw new NotImplementedException('DEV-1459: callback TwiML migration in progress');
  }

  async initiatePhoneCall() {
    throw new NotImplementedException('DEV-1459: phone dialer migration in progress');
  }

  async getCallHistory(workspaceId: string, limit: number, offset: number) {
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
  }

  async streamRecording() {
    throw new NotImplementedException('DEV-1459: recording stream migration in progress');
  }

  async getCall(workspaceId: string, id: string) {
    const rows = await this.dataSource.query(
      'SELECT c.*, ct.name AS contact_name, ct.company AS contact_company FROM calls c LEFT JOIN contacts ct ON c.contact_id = ct.id WHERE (c.id::text = $1 OR c.call_sid = $1) AND c.workspace_id = $2',
      [id, workspaceId],
    );

    return rows[0] ?? null;
  }

  async hangupCall() {
    throw new NotImplementedException('DEV-1459: hangup migration in progress');
  }

  async persistAnalysis(workspaceId: string, id: string, analysis: Record<string, unknown>) {
    const rows = await this.dataSource.query(
      'UPDATE calls SET analysis = $1, updated_at = NOW() WHERE (id::text = $2 OR call_sid = $2) AND workspace_id = $3 RETURNING id',
      [JSON.stringify(analysis), id, workspaceId],
    );

    return rows[0] ?? null;
  }

  async getRecording() {
    throw new NotImplementedException('DEV-1459: recording lookup migration in progress');
  }

  async setDisposition(
    workspaceId: string,
    id: string,
    outcome: string,
    notes?: string,
  ) {
    const rows = await this.dataSource.query(
      'UPDATE calls SET outcome = COALESCE($1, outcome), notes = COALESCE($2, notes), updated_at = NOW() WHERE (id::text = $3 OR call_sid = $3) AND workspace_id = $4 RETURNING id, outcome, notes',
      [outcome, notes ?? null, id, workspaceId],
    );

    return rows[0] ?? null;
  }

  async getTranscript(workspaceId: string, id: string) {
    const rows = await this.dataSource.query(
      'SELECT transcript FROM calls WHERE (id::text = $1 OR call_sid = $1) AND workspace_id = $2',
      [id, workspaceId],
    );

    return rows[0] ?? null;
  }
}
