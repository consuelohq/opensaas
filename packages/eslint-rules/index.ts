import {
  rule as mdxComponentNewlines,
  RULE_NAME as mdxComponentNewlinesName,
} from './rules/mdx-component-newlines';
import {
  rule as noAngleBracketPlaceholders,
  RULE_NAME as noAngleBracketPlaceholdersName,
} from './rules/no-angle-bracket-placeholders';

module.exports = {
  rules: {
    [mdxComponentNewlinesName]: mdxComponentNewlines,
    [noAngleBracketPlaceholdersName]: noAngleBracketPlaceholders,
  },
};
