import { ruleTesterParser } from '../utils/ruleTesterParser';
import { type Rule, RuleTester } from 'eslint';

import { rule, RULE_NAME } from './styled-components-prefixed-with-styled';

const ruleTester = new RuleTester({
  languageOptions: {
    parser: ruleTesterParser,
  },
});

ruleTester.run(RULE_NAME, rule as unknown as Rule.RuleModule, {
  valid: [
    {
      code: 'const StyledButton = styled.button``;',
    },
    {
      code: 'const StyledComponent = styled.div``;',
    },
  ],
  invalid: [
    {
      code: 'const Button = styled.button``;',
      errors: [
        {
          messageId: 'noStyledPrefix',
        },
      ],
    },
    {
      code: 'const Component = styled.div``;',
      errors: [
        {
          messageId: 'noStyledPrefix',
        },
      ],
    },
  ],
});
