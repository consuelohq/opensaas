import {
  AST_NODE_TYPES,
  ESLintUtils,
  type TSESTree,
} from '@typescript-eslint/utils';

// NOTE: The rule will be available in ESLint configs as "@nx/workspace-usage-getLoadable-and-getValue-to-get-atoms"
export const RULE_NAME = 'use-getLoadable-and-getValue-to-get-atoms';

const isSnapshotGetLoadableCall = (
  node: TSESTree.Node,
): node is TSESTree.CallExpression =>
  node.type === AST_NODE_TYPES.CallExpression &&
  node.callee.type === AST_NODE_TYPES.MemberExpression &&
  node.callee.object.type === AST_NODE_TYPES.Identifier &&
  node.callee.object.name === 'snapshot' &&
  node.callee.property.type === AST_NODE_TYPES.Identifier &&
  node.callee.property.name === 'getLoadable';

export const rule = ESLintUtils.RuleCreator(() => __filename)({
  name: RULE_NAME,
  meta: {
    type: 'problem',
    docs: {
      description: 'Ensure you are using getLoadable and getValue',
    },
    fixable: 'code',
    schema: [],
    messages: {
      redundantAwait: 'Redundant await on non-promise',
      invalidAccessorOnSnapshot:
        "Expected to use method 'getLoadable()' on 'snapshot' but instead found '{{ propertyName }}'",
      invalidWayToGetAtoms:
        "Expected to use method 'getValue()' with 'getLoadable()' but instead found '{{ propertyName }}'",
    },
  },
  defaultOptions: [],
  create: (context) => ({
    AwaitExpression: (node) => {
      const { argument, range } = node;
      if (argument.type !== AST_NODE_TYPES.CallExpression || !range) {
        return;
      }

      const { callee } = argument;
      const directlyAwaitsLoadable =
        callee.type === AST_NODE_TYPES.MemberExpression &&
        callee.object.type === AST_NODE_TYPES.Identifier &&
        callee.object.name === 'snapshot' &&
        callee.property.type === AST_NODE_TYPES.Identifier &&
        callee.property.name === 'getLoadable';
      const awaitsLoadableResult =
        callee.type === AST_NODE_TYPES.MemberExpression &&
        isSnapshotGetLoadableCall(callee.object);

      if (
        directlyAwaitsLoadable ||
        awaitsLoadableResult
      ) {
        context.report({
          node,
          messageId: 'redundantAwait',
          fix: (fixer) => fixer.removeRange([range[0], range[0] + 5]),
        });
      }
    },
    MemberExpression: (node) => {
      const { object, property } = node;

      if (
        isSnapshotGetLoadableCall(object) &&
        property.type === AST_NODE_TYPES.Identifier
      ) {
        const propertyName = property.name;

        if (propertyName !== 'getValue') {
          context.report({
            node: property,
            messageId: 'invalidWayToGetAtoms',
            data: {
              propertyName,
            },
            // replace the property with `getValue`
            fix: (fixer) => fixer.replaceText(property, 'getValue'),
          });
        }
      }
    },
    CallExpression: (node) => {
      const { callee } = node;

      if (
        callee.type === AST_NODE_TYPES.MemberExpression &&
        callee.object.type === AST_NODE_TYPES.Identifier &&
        callee.object.name === 'snapshot' &&
        callee.property.type === AST_NODE_TYPES.Identifier &&
        callee.property.name === 'getPromise'
      ) {
        context.report({
          node: callee.property,
          messageId: 'invalidAccessorOnSnapshot',
          data: {
            propertyName: callee.property.name,
          },
          // Replace `getPromise` with `getLoadable`
          fix: (fixer) => fixer.replaceText(callee.property, 'getLoadable'),
        });
      }
    },
  }),
});
