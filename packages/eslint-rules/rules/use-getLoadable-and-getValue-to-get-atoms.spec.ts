import { ruleTesterParser } from '../utils/ruleTesterParser';
import { type Rule, RuleTester } from 'eslint';

import { rule, RULE_NAME } from './use-getLoadable-and-getValue-to-get-atoms';

const ruleTester = new RuleTester({
  languageOptions: {
    parser: ruleTesterParser,
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
    },
  },
});

ruleTester.run(RULE_NAME, rule as unknown as Rule.RuleModule, {
  valid: [
    {
      code: 'const atoms = snapshot.getLoadable(someState).getValue();',
    },
    {
      code: 'const atoms = snapshot.getLoadable(someState(viewId)).getValue();',
    },
  ],
  invalid: [
    {
      code: 'const atoms = await snapshot.getPromise(someState);',
      errors: [
        {
          messageId: 'invalidAccessorOnSnapshot',
        },
      ],
      output: 'const atoms = await snapshot.getLoadable(someState);',
    },
    {
      code: 'const atoms = await snapshot.getPromise(someState(viewId));',
      errors: [
        {
          messageId: 'invalidAccessorOnSnapshot',
        },
      ],
      output: 'const atoms = await snapshot.getLoadable(someState(viewId));',
    },
    {
      code: 'const atoms = snapshot.getLoadable(someState).anotherMethod();',
      errors: [
        {
          messageId: 'invalidWayToGetAtoms',
        },
      ],
      output: 'const atoms = snapshot.getLoadable(someState).getValue();',
    },
  ],
});
