import { ruleTesterParser } from '../utils/ruleTesterParser';
import { type Rule, RuleTester } from 'eslint';

import { rule, RULE_NAME } from './no-state-useref';

const ruleTester = new RuleTester({
  languageOptions: {
    parser: ruleTesterParser,
  },
});

ruleTester.run(RULE_NAME, rule as unknown as Rule.RuleModule, {
  valid: [
    {
      code: 'const scrollableRef = useRef<HTMLDivElement>(null);',
    },
    {
      code: 'const ref = useRef<HTMLInputElement>(null);',
    },
  ],
  invalid: [
    {
      code: 'const ref = useRef(null);',
      errors: [
        {
          messageId: 'noStateUseRef',
        },
      ],
    },
    {
      code: 'const ref = useRef<Boolean>(null);',
      errors: [
        {
          messageId: 'noStateUseRef',
        },
      ],
    },
    {
      code: "const ref = useRef<string>('');",
      errors: [
        {
          messageId: 'noStateUseRef',
        },
      ],
    },
  ],
});
