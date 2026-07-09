function groupByCategory(risks) {
  const grouped = {};

  for (const risk of risks) {
    if (!grouped[risk.category]) {
      grouped[risk.category] = [];
    }

    grouped[risk.category].push(risk.file);
  }

  return grouped;
}

function hasMatch(files, predicate) {
  return files.some((file) => predicate(file));
}

function normalizeFiles(files) {
  return [...new Set(files.map((file) => String(file).split('\\').join('/')))].sort();
}

function isEntityFile(file) {
  return /[.]entity[.]tsx?$/.test(file)
    || /^packages[/][^/]*server[^/]*[/].*[/]entities[/].*[.]tsx?$/.test(file);
}

function isMigrationFile(file) {
  return /[/]migrations?[/].*[.](ts|tsx|js|sql)$/.test(file);
}

function isGraphqlSchemaFile(file) {
  return /[.]graphql$/.test(file)
    || /[.]gql$/.test(file)
    || /graphql[/]schema/i.test(file)
    || /schema[.]graphql/i.test(file)
    || /schema[.]gql/i.test(file);
}

function isGraphqlCodegenFile(file) {
  if (isGraphqlSchemaFile(file)) {
    return false;
  }

  return /codegen/i.test(file)
    || /__generated__/i.test(file)
    || /generated[/]graphql/i.test(file)
    || /graphql.*generated/i.test(file);
}

function isDatabaseScript(file) {
  return /database.*(reset|migrate|migration|sync)/i.test(file)
    || /(reset|migrate|migration|sync).*database/i.test(file)
    || /scripts[/](setup-db|truncate-db|.*migration.*|.*database.*)[.]tsx?$/i.test(file)
    || /(typeorm|datasource|seed)[.]tsx?$/i.test(file);
}

function createRisk(category, file, severity, message) {
  return { category, file, severity, message };
}

function analyzeDbRisk(files) {
  const normalizedFiles = normalizeFiles(files);
  const risks = [];

  for (const file of normalizedFiles) {
    if (isEntityFile(file)) {
      risks.push(createRisk('entity', file, 'warning', 'entity file changed'));
    }

    if (isMigrationFile(file)) {
      risks.push(createRisk('migration', file, 'warning', 'migration file changed'));
    }

    if (isGraphqlSchemaFile(file)) {
      risks.push(createRisk('graphql-schema', file, 'warning', 'graphql schema file changed'));
    }

    if (isGraphqlCodegenFile(file)) {
      risks.push(createRisk('graphql-codegen', file, 'warning', 'graphql codegen/generated file changed'));
    }

    if (isDatabaseScript(file)) {
      risks.push(createRisk('database-script', file, 'warning', 'database reset/migration/sync script changed'));
    }
  }

  const findings = [];
  const entityChanged = hasMatch(normalizedFiles, isEntityFile);
  const migrationChanged = hasMatch(normalizedFiles, isMigrationFile);
  const graphqlSchemaChanged = hasMatch(normalizedFiles, isGraphqlSchemaFile);
  const graphqlCodegenChanged = hasMatch(normalizedFiles, isGraphqlCodegenFile);

  if (entityChanged && !migrationChanged) {
    findings.push({
      rule: 'DB_MIGRATION_REQUIRED',
      severity: 'error',
      message: 'entity changes were detected without a migration file in the same diff',
      files: normalizedFiles.filter(isEntityFile),
    });
  }

  if (graphqlSchemaChanged && !graphqlCodegenChanged) {
    findings.push({
      rule: 'GRAPHQL_CODEGEN_REQUIRED',
      severity: 'error',
      message: 'graphql schema changes were detected without codegen/generated output in the same diff',
      files: normalizedFiles.filter(isGraphqlSchemaFile),
    });
  }

  return {
    risks,
    groupedRisks: groupByCategory(risks),
    findings,
    hasFailures: findings.some((finding) => finding.severity === 'error'),
  };
}

module.exports = {
  analyzeDbRisk,
  isDatabaseScript,
  isEntityFile,
  isGraphqlCodegenFile,
  isGraphqlSchemaFile,
  isMigrationFile,
};
