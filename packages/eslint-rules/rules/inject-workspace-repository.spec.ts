import { ruleTesterParser } from '../utils/ruleTesterParser';
import { type Rule, RuleTester } from 'eslint';
import { rule, RULE_NAME } from './inject-workspace-repository';

const ruleTester = new RuleTester({
  languageOptions: {
    parser: ruleTesterParser,
  },
});

ruleTester.run(RULE_NAME, rule as unknown as Rule.RuleModule, {
  valid: [
    {
      code: `
        class MyWorkspaceService {
          constructor(@InjectWorkspaceRepository() private repository) {}
        }
      `,
      filename: 'my.workspace-service.ts',
    },
    {
      code: `
        class AnotherWorkspaceService {
          constructor(private myWorkspaceService: MyWorkspaceService) {}
        }
      `,
      filename: 'another.workspace-service.ts',
    },
  ],
  invalid: [
    {
      code: `
        class MyService {
          constructor(@InjectWorkspaceRepository() private repository) {}
        }
      `,
      filename: 'my.workspace-service.ts',
      errors: [{ messageId: 'invalidClassName' }],
    },
    {
      code: `
        class MyWorkspaceService {
          constructor(@InjectWorkspaceRepository() private repository) {}
        }
      `,
      filename: 'my.service.ts',
      errors: [{ messageId: 'invalidFileName' }],
    },
    {
      code: `
        class MyService {
          constructor(@InjectWorkspaceRepository() private repository) {}
        }
      `,
      filename: 'my.service.ts',
      errors: [
        { messageId: 'invalidClassName' },
        { messageId: 'invalidFileName' },
      ],
    },
    {
      code: `
        class AnotherWorkspaceService {
          constructor(private myWorkspaceService: MyWorkspaceService) {}
        }
      `,
      filename: 'another.service.ts',
      errors: [{ messageId: 'invalidFileName' }],
    },
    {
      code: `
        class AnotherService {
          constructor(private myWorkspaceService: MyWorkspaceService) {}
        }
      `,
      filename: 'another.workspace-service.ts',
      errors: [{ messageId: 'invalidClassName' }],
    },
  ],
});
