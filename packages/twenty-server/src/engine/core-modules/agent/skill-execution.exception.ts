import { type MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { assertUnreachable } from 'twenty-shared/utils';

import { CustomException } from 'src/utils/custom-exception';

export enum SkillExecutionExceptionCode {
  SKILL_NOT_FOUND = 'SKILL_NOT_FOUND',
  INPUT_VALIDATION_FAILED = 'INPUT_VALIDATION_FAILED',
  INTEGRATION_MISSING = 'INTEGRATION_MISSING',
  TOOL_EXECUTION_FAILED = 'TOOL_EXECUTION_FAILED',
  SANDBOX_TIMEOUT = 'SANDBOX_TIMEOUT',
  SANDBOX_ERROR = 'SANDBOX_ERROR',
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
}

const getSkillExecutionExceptionMessage = (
  code: SkillExecutionExceptionCode,
): MessageDescriptor => {
  switch (code) {
    case SkillExecutionExceptionCode.SKILL_NOT_FOUND:
      return msg`Skill not found.`;
    case SkillExecutionExceptionCode.INPUT_VALIDATION_FAILED:
      return msg`Skill input validation failed.`;
    case SkillExecutionExceptionCode.INTEGRATION_MISSING:
      return msg`Required integration is not connected.`;
    case SkillExecutionExceptionCode.TOOL_EXECUTION_FAILED:
      return msg`Tool execution failed during skill run.`;
    case SkillExecutionExceptionCode.SANDBOX_TIMEOUT:
      return msg`Sandbox execution timed out.`;
    case SkillExecutionExceptionCode.SANDBOX_ERROR:
      return msg`Sandbox execution failed.`;
    case SkillExecutionExceptionCode.PROVIDER_ERROR:
      return msg`AI provider returned an error.`;
    case SkillExecutionExceptionCode.PERMISSION_DENIED:
      return msg`You do not have permission to run this skill.`;
    default:
      assertUnreachable(code);
  }
};

export class SkillExecutionException extends CustomException<SkillExecutionExceptionCode> {
  constructor(
    message: string,
    code: SkillExecutionExceptionCode,
    { userFriendlyMessage }: { userFriendlyMessage?: MessageDescriptor } = {},
  ) {
    super(message, code, {
      userFriendlyMessage:
        userFriendlyMessage ?? getSkillExecutionExceptionMessage(code),
    });
  }
}
