import { type ParsedDomain, type parse } from 'psl';
import { isDefined } from 'twenty-shared/utils';

export const isParsedDomain = (
  result: ReturnType<typeof parse>,
): result is ParsedDomain =>
  !('error' in result && isDefined(result.error)) &&
  Object.prototype.hasOwnProperty.call(result, 'sld');
