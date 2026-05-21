import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';

import { randomUUID } from 'node:crypto';
import * as Sentry from '@sentry/node';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { isValidPhone, normalizePhone } from '@consuelo/contacts';
import { Dialer, type ParallelDialProfile } from '@consuelo/dialer';
import { type DataSource } from 'typeorm';

import { LegacyDialerService } from 'src/engine/core-modules/consuelo-api/services/legacy-dialer.service';

type DialerCallSource = 'direct' | 'queue';
type DialerCallSelectionStrategy = 'single' | 'predictive';
type DialerScenarioCallMode = 'mock' | 'twilio-test' | 'live';
type DialerCallStartStatus = 'mocked' | 'dialing';

export type StartDialerCallInput = {
  source: DialerCallSource;
  selectionStrategy: DialerCallSelectionStrategy;
  requestedFanout: number;
  targetPhone?: string | null;
  targetPhones?: string[] | null;
  contactId?: string | null;
  contactIds?: string[] | null;
  queueId?: string | null;
  callerIdNumber?: string | null;
  callMode?: DialerScenarioCallMode | null;
};

export type DialerCallStartCapacity = {
  requestedFanout: number;
  callableTargetCount: number;
  availableCallerIdCount: number;
  reducedCapacityReasons: string[];
  blockedReasons: string[];
  actualFanout: number;
};

export type DialerCallStartCall = {
  callSid: string;
  contactId: string;
  customerNumber: string;
  callerId: string;
  status: string;
  position: number;
};

export type DialerCallStartResult = {
  sessionId: string;
  twilioGroupId: string | null;
  queueId: string;
  selectionStrategy: DialerCallSelectionStrategy;
  requestedFanout: number;
  actualFanout: number;
  status: DialerCallStartStatus;
  capacity: DialerCallStartCapacity;
  calls: DialerCallStartCall[];
};

type CallableTarget = {
  contactId: string;
  phone: string;
  queueItemId?: string;
};

type ContactRow = {
  id: string;
  phone: string | null;
};

type QueueTargetRow = {
  queue_item_id: string;
  contact_id: string;
  phone: string | null;
  dnc_status: string | null;
  attempts: number | null;
};

const MOCK_CALLER_ID_BASE = '+1415555010';
const MOCK_PARALLEL_PROFILE: ParallelDialProfile = {
  id: 'balanced',
  fanout: 1,
  staggerMs: 0,
  amdPolicy: 'human-or-unknown',
  terminationPolicy: 'winner-take-all',
};

const redactPhoneNumber = (phoneNumber: string): string =>
  phoneNumber.replace(/^\+?\d*(\d{4})$/, '***$1');

@Injectable()
export class DialerCallStartService {
  private readonly logger = new Logger(DialerCallStartService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(LegacyDialerService)
    private readonly legacyDialerService: LegacyDialerService,
  ) {}

  async startDialerCall(params: {
    workspaceId: string;
    userId: string;
    input: StartDialerCallInput;
  }): Promise<DialerCallStartResult> {
    this.validateInput(params.input);

    const callMode = this.resolveCallMode(params.input.callMode);
    const enforceScenarioAllowlist = this.shouldEnforceScenarioAllowlist(
      params.input.callMode,
    );
    const requestedFanout = Math.max(1, params.input.requestedFanout);
    const sessionId = `session_${randomUUID().replace(/-/g, '').slice(0, 20)}`;

    try {
      const inputQueueId =
        params.input.source === 'queue'
          ? await this.resolveInputQueueId({
              workspaceId: params.workspaceId,
              userId: params.userId,
              input: params.input,
            })
          : null;
      const targets =
        params.input.source === 'direct'
          ? await this.resolveDirectTarget(params)
          : await this.resolveQueueTargets({
              workspaceId: params.workspaceId,
              queueId: this.requireString(inputQueueId, 'queueId'),
              requestedFanout,
            });

      const uniqueTargets = this.dedupeTargetsByPhone(targets);

      if (enforceScenarioAllowlist) {
        this.assertSafeTargetsAllowed(uniqueTargets);
      }

      if (callMode === 'twilio-test') {
        this.createTwilioTestDialer();
      }

      const callerIds = await this.resolveCallerIds({
        callerIdNumber: params.input.callerIdNumber,
        callMode,
        enforceScenarioAllowlist,
        targetCount: uniqueTargets.length,
      });
      const capacity = this.computeCapacity({
        requestedFanout,
        callableTargetCount: uniqueTargets.length,
        availableCallerIdCount: callerIds.length,
      });

      if (capacity.actualFanout === 0) {
        throw new BadRequestException({
          code: 'NO_CALLABLE_TARGETS',
          message: 'No callable targets or caller IDs are available',
          capacity,
        });
      }

      const selectedTargets = uniqueTargets.slice(0, capacity.actualFanout);
      const selectedCallerIds = callerIds.slice(0, capacity.actualFanout);
      const queueId =
        params.input.source === 'direct'
          ? await this.createDirectQueue({
              workspaceId: params.workspaceId,
              userId: params.userId,
              contactIds: selectedTargets.map((target) => target.contactId),
            })
          : this.requireString(inputQueueId, 'queueId');

      if (callMode === 'mock') {
        const calls = await this.createMockCalls({
          workspaceId: params.workspaceId,
          sessionId,
          queueId,
          targets: selectedTargets,
          callerIds: selectedCallerIds,
        });

        return {
          sessionId,
          twilioGroupId: null,
          queueId,
          selectionStrategy: params.input.selectionStrategy,
          requestedFanout,
          actualFanout: capacity.actualFanout,
          status: 'mocked',
          capacity,
          calls,
        };
      }

      const twilioResult = await this.initiateTwilioCalls({
        workspaceId: params.workspaceId,
        userId: params.userId,
        sessionId,
        queueId,
        targets: selectedTargets,
        callerIds: selectedCallerIds,
        callMode,
      });

      return {
        sessionId,
        twilioGroupId: twilioResult.twilioGroupId,
        queueId,
        selectionStrategy: params.input.selectionStrategy,
        requestedFanout,
        actualFanout: capacity.actualFanout,
        status: 'dialing',
        capacity,
        calls: twilioResult.calls,
      };
    } catch (err: unknown) {
      if (err instanceof BadRequestException) {
        throw err;
      }

      const message = err instanceof Error ? err.message : 'Unknown error';

      this.logger.error('[DialerCallStart] start failed', {
        workspaceId: params.workspaceId,
        userId: params.userId,
        source: params.input.source,
        selectionStrategy: params.input.selectionStrategy,
        requestedFanout,
        callMode,
        errorMessage: this.redactPhoneNumbers(message),
      });
      Sentry.captureException(err, {
        extra: {
          context: 'dialer_call_start',
          workspaceId: params.workspaceId,
          source: params.input.source,
          selectionStrategy: params.input.selectionStrategy,
          requestedFanout,
          callMode,
        },
      });

      throw new InternalServerErrorException({
        code: 'DIALER_CALL_START_FAILED',
        message: 'Dialer call start failed',
      });
    }
  }

  private validateInput(input: StartDialerCallInput): void {
    if (input.source === 'direct' && input.selectionStrategy !== 'single') {
      throw new BadRequestException(
        'Direct call starts must use single selection strategy',
      );
    }

    if (input.source === 'queue' && input.selectionStrategy !== 'predictive') {
      throw new BadRequestException(
        'Queue call starts must use predictive selection strategy',
      );
    }

    if (input.requestedFanout < 1) {
      throw new BadRequestException('requestedFanout must be at least 1');
    }

    if (input.source === 'direct' && !input.contactId && !input.targetPhone) {
      throw new BadRequestException(
        'Direct call starts require contactId or targetPhone',
      );
    }

    if (
      input.source === 'queue' &&
      !input.queueId &&
      (!input.contactIds || input.contactIds.length === 0) &&
      (!input.targetPhones || input.targetPhones.length === 0)
    ) {
      throw new BadRequestException(
        'Queue call starts require queueId, contactIds, or targetPhones',
      );
    }
  }

  private resolveCallMode(
    callMode: DialerScenarioCallMode | null | undefined,
  ): DialerScenarioCallMode {
    if (callMode) {
      return callMode;
    }

    return 'live';
  }

  private shouldEnforceScenarioAllowlist(
    callMode: DialerScenarioCallMode | null | undefined,
  ): boolean {
    return callMode === 'live' || callMode === 'twilio-test';
  }

  private async resolveInputQueueId(params: {
    workspaceId: string;
    userId: string;
    input: StartDialerCallInput;
  }): Promise<string> {
    if (params.input.queueId) {
      return params.input.queueId;
    }

    const contactIds =
      params.input.contactIds && params.input.contactIds.length > 0
        ? params.input.contactIds
        : await this.findOrCreatePhoneOnlyContacts({
            workspaceId: params.workspaceId,
            phones: params.input.targetPhones ?? [],
          });

    return this.createPredictiveScenarioQueue({
      workspaceId: params.workspaceId,
      userId: params.userId,
      contactIds,
    });
  }

  private async resolveDirectTarget(params: {
    workspaceId: string;
    userId: string;
    input: StartDialerCallInput;
  }): Promise<CallableTarget[]> {
    if (params.input.contactId) {
      const rows = (await this.dataSource.query(
        'SELECT id, phone FROM contacts WHERE id = $1 AND workspace_id = $2',
        [params.input.contactId, params.workspaceId],
      )) as ContactRow[];
      const contact = rows[0];

      if (!contact?.phone) {
        throw new BadRequestException('Contact has no callable phone number');
      }

      return [
        {
          contactId: contact.id,
          phone: this.readValidPhoneNumber(contact.phone),
        },
      ];
    }

    const phone = this.readValidPhoneNumber(
      this.requireString(params.input.targetPhone, 'targetPhone'),
    );
    const contactId = await this.findOrCreatePhoneOnlyContact({
      workspaceId: params.workspaceId,
      phone,
    });

    return [{ contactId, phone }];
  }

  private async findOrCreatePhoneOnlyContact(params: {
    workspaceId: string;
    phone: string;
  }): Promise<string> {
    const existingRows = (await this.dataSource.query(
      'SELECT id, phone FROM contacts WHERE workspace_id = $1 AND phone = $2 LIMIT 1',
      [params.workspaceId, params.phone],
    )) as ContactRow[];

    if (existingRows[0]?.id) {
      return existingRows[0].id;
    }

    const rows = (await this.dataSource.query(
      'INSERT INTO contacts (workspace_id, name, phone, source, tags) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [
        params.workspaceId,
        `Phone ${redactPhoneNumber(params.phone)}`,
        params.phone,
        'dialer',
        ['dialer-direct'],
      ],
    )) as Array<{ id: string }>;

    return rows[0].id;
  }

  private async findOrCreatePhoneOnlyContacts(params: {
    workspaceId: string;
    phones: string[];
  }): Promise<string[]> {
    const contactIds: string[] = [];

    for (const phoneValue of params.phones) {
      const phone = this.readValidPhoneNumber(phoneValue);

      contactIds.push(
        await this.findOrCreatePhoneOnlyContact({
          workspaceId: params.workspaceId,
          phone,
        }),
      );
    }

    return contactIds;
  }

  private async resolveQueueTargets(params: {
    workspaceId: string;
    queueId: string;
    requestedFanout: number;
  }): Promise<CallableTarget[]> {
    const rows = (await this.dataSource.query(
      `SELECT qi.id AS queue_item_id,
              qi.contact_id,
              qi.attempts,
              contacts.phone,
              contacts.dnc_status
         FROM queue_items qi
         JOIN call_queues cq ON cq.id = qi.queue_id
         JOIN contacts
           ON contacts.id::text = qi.contact_id
          AND contacts.workspace_id::text = cq.workspace_id
        WHERE qi.queue_id = $1
          AND cq.workspace_id = $2
          AND qi.status IN ('calling', 'pending')
        ORDER BY
          CASE qi.status WHEN 'calling' THEN 0 ELSE 1 END,
          qi.position ASC
        LIMIT $3`,
      [params.queueId, params.workspaceId, params.requestedFanout * 3],
    )) as QueueTargetRow[];

    const targets: CallableTarget[] = [];

    for (const row of rows) {
      if (row.dnc_status === 'blocked' || row.dnc_status === 'dnc') {
        continue;
      }

      if ((row.attempts ?? 0) >= 5) {
        continue;
      }

      const phone = this.tryReadValidPhoneNumber(row.phone);

      if (!phone) {
        continue;
      }

      targets.push({
        contactId: row.contact_id,
        phone,
        queueItemId: row.queue_item_id,
      });
    }

    return targets;
  }

  private dedupeTargetsByPhone(targets: CallableTarget[]): CallableTarget[] {
    const seenPhones = new Set<string>();
    const uniqueTargets: CallableTarget[] = [];

    for (const target of targets) {
      if (seenPhones.has(target.phone)) {
        continue;
      }

      seenPhones.add(target.phone);
      uniqueTargets.push(target);
    }

    return uniqueTargets;
  }

  private async resolveCallerIds(params: {
    callerIdNumber?: string | null;
    callMode: DialerScenarioCallMode;
    enforceScenarioAllowlist: boolean;
    targetCount: number;
  }): Promise<string[]> {
    const safeFromNumbers = params.enforceScenarioAllowlist
      ? this.readSafePhoneNumbersFromEnv('CONSUELO_SCENARIO_SAFE_FROM_NUMBERS')
      : null;

    if (params.callerIdNumber) {
      const callerId = this.readValidPhoneNumber(params.callerIdNumber);

      if (safeFromNumbers && !safeFromNumbers.has(callerId)) {
        throw new BadRequestException('Caller ID number is not allowlisted');
      }

      return [callerId];
    }

    if (params.callMode === 'mock') {
      return this.expandMockCallerIds(params.targetCount);
    }

    if (params.callMode === 'twilio-test') {
      this.createTwilioTestDialer();
      throw new BadRequestException(
        'twilio-test mode requires an explicit callerIdNumber',
      );
    }

    const dialer = this.legacyDialerService.getDialer();
    const lockService = this.legacyDialerService.getCallerIdLockService();
    const accountNumbers = await dialer.listNumbers();
    const callerIds: string[] = [];

    for (const number of accountNumbers) {
      const phone = this.tryReadValidPhoneNumber(number.phoneNumber);

      if (!phone) {
        continue;
      }

      if (safeFromNumbers && !safeFromNumbers.has(phone)) {
        continue;
      }

      if (await lockService.isNumberAvailable(phone)) {
        callerIds.push(phone);
      }
    }

    return callerIds;
  }

  private expandMockCallerIds(targetCount: number): string[] {
    const configuredNumbers = (
      process.env.CONSUELO_SCENARIO_SAFE_FROM_NUMBERS ?? ''
    )
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
      .map((value) => this.tryReadValidPhoneNumber(value))
      .filter((value): value is string => value !== null);

    if (configuredNumbers.length > 0) {
      return configuredNumbers;
    }

    return Array.from(
      { length: Math.max(1, targetCount) },
      (_, index) => `${MOCK_CALLER_ID_BASE}${index}`,
    );
  }

  private computeCapacity(params: {
    requestedFanout: number;
    callableTargetCount: number;
    availableCallerIdCount: number;
  }): DialerCallStartCapacity {
    const actualFanout = Math.min(
      params.requestedFanout,
      params.callableTargetCount,
      params.availableCallerIdCount,
    );
    const reducedCapacityReasons: string[] = [];
    const blockedReasons: string[] = [];

    if (params.callableTargetCount < params.requestedFanout) {
      reducedCapacityReasons.push('callable-target-capacity');
    }

    if (params.availableCallerIdCount < params.requestedFanout) {
      reducedCapacityReasons.push('caller-id-capacity');
    }

    if (params.callableTargetCount === 0) {
      blockedReasons.push('no-callable-targets');
    }

    if (params.availableCallerIdCount === 0) {
      blockedReasons.push('no-available-caller-ids');
    }

    return {
      ...params,
      reducedCapacityReasons,
      blockedReasons,
      actualFanout,
    };
  }

  private async createDirectQueue(params: {
    workspaceId: string;
    userId: string;
    contactIds: string[];
  }): Promise<string> {
    const queueRows = (await this.dataSource.query(
      'INSERT INTO call_queues (workspace_id, user_id, name, source_type, category, calling_mode, total_contacts) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [
        params.workspaceId,
        params.userId,
        'Direct call',
        'direct',
        'single',
        'server',
        params.contactIds.length,
      ],
    )) as Array<{ id: string }>;

    const queueId = queueRows[0].id;

    for (const [index, contactId] of params.contactIds.entries()) {
      await this.dataSource.query(
        'INSERT INTO queue_items (queue_id, contact_id, position) VALUES ($1, $2, $3)',
        [queueId, contactId, index + 1],
      );
    }

    return queueId;
  }

  private async createPredictiveScenarioQueue(params: {
    workspaceId: string;
    userId: string;
    contactIds: string[];
  }): Promise<string> {
    if (params.contactIds.length === 0) {
      throw new BadRequestException(
        'contactIds are required to create a queue',
      );
    }

    const queueRows = (await this.dataSource.query(
      'INSERT INTO call_queues (workspace_id, user_id, name, source_type, category, calling_mode, total_contacts) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [
        params.workspaceId,
        params.userId,
        'Predictive scenario',
        'scenario',
        'predictive',
        'server',
        params.contactIds.length,
      ],
    )) as Array<{ id: string }>;

    const queueId = queueRows[0].id;

    for (const [index, contactId] of params.contactIds.entries()) {
      await this.dataSource.query(
        'INSERT INTO queue_items (queue_id, contact_id, position) VALUES ($1, $2, $3)',
        [queueId, contactId, index + 1],
      );
    }

    return queueId;
  }

  private async createMockCalls(params: {
    workspaceId: string;
    sessionId: string;
    queueId: string;
    targets: CallableTarget[];
    callerIds: string[];
  }): Promise<DialerCallStartCall[]> {
    const calls: DialerCallStartCall[] = [];

    for (const [index, target] of params.targets.entries()) {
      const callSid = `mock_${randomUUID().replace(/-/g, '').slice(0, 24)}`;
      const callerId = params.callerIds[index];

      await this.insertCallRow({
        workspaceId: params.workspaceId,
        sessionId: params.sessionId,
        twilioGroupId: null,
        queueId: params.queueId,
        callSid,
        contactId: target.contactId,
        to: target.phone,
        from: callerId,
        status: 'mocked',
        position: index + 1,
      });

      calls.push({
        callSid,
        contactId: target.contactId,
        customerNumber: target.phone,
        callerId,
        status: 'mocked',
        position: index + 1,
      });
    }

    return calls;
  }

  private async initiateTwilioCalls(params: {
    workspaceId: string;
    userId: string;
    sessionId: string;
    queueId: string;
    targets: CallableTarget[];
    callerIds: string[];
    callMode: DialerScenarioCallMode;
  }): Promise<{ calls: DialerCallStartCall[]; twilioGroupId: string }> {
    const lockService = this.legacyDialerService.getCallerIdLockService();
    const acquiredCallerIds: string[] = [];
    const lockCallSid = `pending:${params.sessionId}`;
    let groupId: string | null = null;
    let twilioDialer: Dialer | null = null;

    try {
      for (const callerId of params.callerIds) {
        const acquired = await lockService.acquireLock(
          callerId,
          params.userId,
          lockCallSid,
        );

        if (!acquired) {
          throw new BadRequestException('Caller ID number is currently in use');
        }

        acquiredCallerIds.push(callerId);
      }

      const baseUrl = process.env.API_BASE_URL ?? process.env.SERVER_URL ?? '';
      if (params.callMode === 'live' || params.callMode === 'twilio-test') {
        this.assertPublicCallbackBaseUrl(baseUrl);
      }
      twilioDialer =
        params.callMode === 'twilio-test'
          ? this.createTwilioTestDialer()
          : this.legacyDialerService.getDialer();
      const result = await twilioDialer.parallel.initiateGroup({
        customerNumbers: params.targets.map((target) => target.phone),
        queueId: params.queueId,
        contactIds: params.targets.map((target) => target.contactId),
        userId: params.userId,
        fromNumbers: params.callerIds,
        statusCallbackUrl: `${baseUrl}/api/v1/calls/parallel/status-callback`,
        customerTwimlUrl: `${baseUrl}/api/v1/calls/parallel/customer-twiml`,
        profile: { ...MOCK_PARALLEL_PROFILE, fanout: params.targets.length },
      });
      groupId = result.groupId;

      const calls: DialerCallStartCall[] = [];

      for (const call of result.calls) {
        const target = params.targets[call.position - 1];
        const transferred = await lockService.transferLock(
          call.fromNumber,
          lockCallSid,
          call.callSid,
        );

        if (!transferred) {
          throw new Error('Caller ID lock transfer failed after call creation');
        }

        await this.insertCallRow({
          workspaceId: params.workspaceId,
          sessionId: params.sessionId,
          twilioGroupId: groupId,
          queueId: params.queueId,
          callSid: call.callSid,
          contactId: target.contactId,
          to: target.phone,
          from: call.fromNumber,
          status: call.status,
          position: call.position,
        });

        calls.push({
          callSid: call.callSid,
          contactId: target.contactId,
          customerNumber: target.phone,
          callerId: call.fromNumber,
          status: call.status,
          position: call.position,
        });
      }

      if (!groupId) {
        throw new Error('Twilio group ID was not returned after call creation');
      }

      return { calls, twilioGroupId: groupId };
    } catch (err: unknown) {
      if (groupId) {
        try {
          await twilioDialer?.parallel.terminateGroup(groupId);
        } catch (cleanupErr: unknown) {
          this.logger.error('[DialerCallStart] group cleanup failed', {
            workspaceId: params.workspaceId,
            groupId,
            errorMessage:
              cleanupErr instanceof Error
                ? this.redactPhoneNumbers(cleanupErr.message)
                : 'Unknown cleanup error',
          });
        }
      }

      for (const callerId of acquiredCallerIds) {
        await lockService.releaseLockByNumber(callerId);
      }

      throw err;
    }
  }

  private async insertCallRow(params: {
    workspaceId: string;
    sessionId: string;
    twilioGroupId: string | null;
    queueId: string;
    callSid: string;
    contactId: string;
    to: string;
    from: string;
    status: string;
    position: number;
  }): Promise<void> {
    await this.dataSource.query(
      'INSERT INTO calls (workspace_id, call_sid, contact_id, direction, status, "from", "to", start_time, parallel_group_id, parallel_position, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9, NOW(), NOW())',
      [
        params.workspaceId,
        params.callSid,
        params.contactId,
        'outbound',
        params.status,
        params.from,
        params.to,
        params.twilioGroupId ?? params.sessionId,
        params.position,
      ],
    );
  }

  private createTwilioTestDialer(): Dialer {
    const accountSid = process.env.TWILIO_TEST_ACCOUNT_SID ?? '';
    const authToken = process.env.TWILIO_TEST_AUTH_TOKEN ?? '';

    if (!accountSid || !authToken) {
      throw new BadRequestException(
        'twilio-test mode requires TWILIO_TEST_ACCOUNT_SID and TWILIO_TEST_AUTH_TOKEN',
      );
    }

    if (
      accountSid === process.env.TWILIO_ACCOUNT_SID ||
      authToken === process.env.TWILIO_AUTH_TOKEN
    ) {
      throw new BadRequestException(
        'twilio-test mode cannot use live Twilio credentials',
      );
    }

    return new Dialer({
      credentials: {
        accountSid,
        authToken,
      },
      baseUrl: process.env.API_BASE_URL,
    });
  }

  private assertPublicCallbackBaseUrl(baseUrl: string): void {
    if (!baseUrl.startsWith('https://')) {
      throw new BadRequestException(
        'Twilio-backed dialer mode requires a public HTTPS API_BASE_URL or SERVER_URL for callbacks',
      );
    }

    if (
      baseUrl.includes('127.0.0.1') ||
      baseUrl.includes('localhost') ||
      baseUrl.includes('::1')
    ) {
      throw new BadRequestException(
        'Twilio-backed dialer mode requires a callback URL reachable by Twilio',
      );
    }
  }

  private readValidPhoneNumber(value: string): string {
    const normalizedPhoneNumber = normalizePhone(value);

    if (!isValidPhone(normalizedPhoneNumber)) {
      throw new BadRequestException('Phone number must be E.164 format');
    }

    return normalizedPhoneNumber;
  }

  private assertSafeTargetsAllowed(targets: CallableTarget[]): void {
    const safeToNumbers = this.readSafePhoneNumbersFromEnv(
      'CONSUELO_SCENARIO_SAFE_TO_NUMBERS',
    );

    for (const target of targets) {
      if (!safeToNumbers.has(target.phone)) {
        throw new BadRequestException('Target phone number is not allowlisted');
      }
    }
  }

  private readSafePhoneNumbersFromEnv(envName: string): Set<string> {
    const values = (process.env[envName] ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    if (values.length === 0) {
      throw new BadRequestException('Live dialer allowlist is required');
    }

    return new Set(values.map((value) => this.readValidPhoneNumber(value)));
  }

  private tryReadValidPhoneNumber(
    value: string | null | undefined,
  ): string | null {
    if (!value) {
      return null;
    }

    try {
      return this.readValidPhoneNumber(value);
    } catch {
      return null;
    }
  }

  private requireString(
    value: string | null | undefined,
    fieldName: string,
  ): string {
    const parsedValue = value?.trim() ?? '';

    if (parsedValue.length === 0) {
      throw new BadRequestException(`${fieldName} is required`);
    }

    return parsedValue;
  }

  private redactPhoneNumbers(message: string): string {
    return message.replace(/\+\d{7,15}/g, (match) => {
      return `***${match.slice(-4)}`;
    });
  }
}
