import { ruleTesterParser } from '../utils/ruleTesterParser';
import { type Rule, RuleTester } from 'eslint';

import { rule, RULE_NAME } from './no-navigate-prefer-link';

const ruleTester = new RuleTester({
  languageOptions: {
    parser: ruleTesterParser,
  },
});

ruleTester.run(RULE_NAME, rule as unknown as Rule.RuleModule, {
  valid: [
    {
      code: 'if(someVar) { navigate("/"); }',
    },
    {
      code: '<Link to="/"><Button>Click me</Button></Link>',
      languageOptions: {
        parserOptions: {
          ecmaFeatures: {
            jsx: true,
          },
        },
      },
    },
    {
      code: '<Button onClick={() =>{ navigate("/"); doSomething(); }} />',
      languageOptions: {
        parserOptions: {
          ecmaFeatures: {
            jsx: true,
          },
        },
      },
    },
  ],
  invalid: [
    {
      code: '<Button onClick={() => navigate("/")} />',
      errors: [
        {
          messageId: 'preferLink',
        },
      ],
      languageOptions: {
        parserOptions: {
          ecmaFeatures: {
            jsx: true,
          },
        },
      },
    },
    {
      code: '<Button onClick={() => { navigate("/");} } />',
      errors: [
        {
          messageId: 'preferLink',
        },
      ],
      languageOptions: {
        parserOptions: {
          ecmaFeatures: {
            jsx: true,
          },
        },
      },
    },
  ],
});
