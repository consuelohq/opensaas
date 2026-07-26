import { ruleTesterParser } from '../utils/ruleTesterParser';
import { type Rule, RuleTester } from 'eslint';

import { rule, RULE_NAME } from './max-consts-per-file';

const max = 1;

const ruleTester = new RuleTester({
  languageOptions: {
    parser: ruleTesterParser,
  },
});

ruleTester.run(RULE_NAME, rule as unknown as Rule.RuleModule, {
  valid: [
    {
      code: 'const A = 1;',
      options: [{ max }],
    },
  ],
  invalid: [
    {
      code: 'const NAME_A = 1;\nconst NAME_B = 2;',
      options: [{ max }],
      errors: [{ messageId: 'tooManyConstants', data: { max } }],
    },
  ],
});
