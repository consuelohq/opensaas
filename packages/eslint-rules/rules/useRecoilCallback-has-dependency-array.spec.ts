import { ruleTesterParser } from '../utils/ruleTesterParser';
import { type Rule, RuleTester } from 'eslint';

import { rule, RULE_NAME } from './useRecoilCallback-has-dependency-array';

const ruleTester = new RuleTester({
  languageOptions: {
    parser: ruleTesterParser,
  },
});

ruleTester.run(RULE_NAME, rule as unknown as Rule.RuleModule, {
  valid: [
    {
      code: 'const someValue = useRecoilCallback(() => () => {}, []);',
    },
    {
      code: 'const someValue = useRecoilCallback(() => () => {}, [dependency]);',
    },
  ],
  invalid: [
    {
      code: 'const someValue = useRecoilCallback(({}) => () => {});',
      errors: [
        {
          messageId: 'isNecessaryDependencyArray',
        },
      ],
      output: 'const someValue = useRecoilCallback(({}) => () => {}, []);',
    },
  ],
});
