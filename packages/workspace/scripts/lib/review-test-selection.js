const path = require('path');

function isLintConfigurationFile(file) {
  return /(^|\/)eslint\.config\.[cm]?[jt]s$/.test(String(file || ''));
}

function reviewTaskEntrypoint(taskRoot) {
  return path.join(taskRoot, 'packages', 'workspace', 'scripts', 'review.js');
}

function reviewTestPackages(files, root, fileExists) {
  const packages = [
    ...new Set(
      files
        .filter((file) => !isLintConfigurationFile(file))
        .map((file) => {
          const match = file.match(/^packages\/([^/]+)\//);
          return match ? match[1] : null;
        })
        .filter(Boolean),
    ),
  ];

  return packages.filter((pkg) =>
    fileExists(path.join(root, 'packages', pkg, 'jest.config.mjs')),
  );
}

module.exports = {
  isLintConfigurationFile,
  reviewTaskEntrypoint,
  reviewTestPackages,
};
