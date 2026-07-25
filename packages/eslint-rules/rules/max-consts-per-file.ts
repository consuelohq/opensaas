import { type TSESTree } from '@typescript-eslint/utils';

import { createRule } from '../utils/createRule';

// NOTE: The rule will be available in ESLint configs as "@nx/workspace-max-consts-per-file"
export const RULE_NAME = 'max-consts-per-file';

type Options = [{ max: number }];
type MessageIds = 'tooManyConstants';

export const rule = createRule<Options, MessageIds>({
  name: RULE_NAME,
  meta: {
    type: 'problem',
    docs: {
      description:
        'Ensure there are at most a specified number of const declarations constant file',
    },
    fixable: 'code',
    schema: [
      {
        type: 'object',
        properties: {
          max: {
            type: 'integer',
            minimum: 0,
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      tooManyConstants:
        'Only a maximum of ({{ max }}) const declarations are allowed in this file.',
    },
  },
  defaultOptions: [{ max: 1 }],
  create: (context) => {
    const [{ max }] = context.options;

    let constCount = 0;

    return {
      VariableDeclaration: (node: TSESTree.VariableDeclaration) => {
        constCount++;

        if (constCount > max) {
          context.report({
            node,
            messageId: 'tooManyConstants',
            data: {
              max,
            },
          });
        }
      },
    };
  },
});
