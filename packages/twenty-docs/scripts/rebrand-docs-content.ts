import fs from 'fs';
import path from 'path';

type Mode = 'audit' | 'apply';

type FileChange = {
  filePath: string;
  replacements: number;
  kind: 'content' | 'json';
};

type RenameChange = {
  fromPath: string;
  toPath: string;
};

type ProcessResult = {
  updatedValue: string;
  replacements: number;
};

type StructuredProcessResult = {
  updatedValue: unknown;
  replacements: number;
};

const docsRoot = path.resolve(__dirname, '..');
const localesRoot = path.join(docsRoot, 'l');

const contentRoots = [
  'developers',
  'snippets',
  'twenty-ui',
  'consuelo-ui',
  'user-guide',
];

const jsonFiles = [
  path.join(docsRoot, 'docs.json'),
  path.join(docsRoot, 'navigation', 'base-structure.json'),
];

const protectedPatterns = [
  /```[\s\S]*?```/g,
  /`[^`\n]+`/g,
  /^(?:import|export)\s.+$/gm,
  /https?:\/\/[^\s)'">]+/g,
];

const brandReplacementRules = [
  {
    pattern: /(?<![\w/@-])Twenty's(?![\w/@-])/g,
    replacement: "Consuelo's",
  },
  {
    pattern: /(?<![\w/@-])twenty's(?![\w/@-])/g,
    replacement: "consuelo's",
  },
  {
    pattern: /(?<![\w/@-])TWENTY(?![\w/@-])/g,
    replacement: 'CONSUELO',
  },
  {
    pattern: /(?<![\w/@-])Twenty(?![\w/@-])/g,
    replacement: 'Consuelo',
  },
  {
    pattern: /(?<![\w/@-])twenty(?![\w/@-])/g,
    replacement: 'consuelo',
  },
];

const slugReplacements = [
  ['twenty-ui', 'consuelo-ui'],
  ['what-is-twenty', 'what-is-consuelo'],
  ['navigate-around-twenty', 'navigate-around-consuelo'],
  ['can-i-send-emails-from-twenty', 'can-i-send-emails-from-consuelo'],
  ['can-i-book-meetings-from-twenty', 'can-i-book-meetings-from-consuelo'],
  [
    'bring-typeform-submissions-in-twenty',
    'bring-typeform-submissions-in-consuelo',
  ],
  ['bring-product-data-in-twenty', 'bring-product-data-in-consuelo'],
  [
    'generate-quote-or-invoice-from-twenty',
    'generate-quote-or-invoice-from-consuelo',
  ],
  ['generate-pdf-from-twenty', 'generate-pdf-from-consuelo'],
] as const;

const imagePathReplacements = [
  ['images/user-guide/what-is-twenty', 'images/user-guide/what-is-consuelo'],
  [
    'images/user-guide/home/what-is-twenty.png',
    'images/user-guide/home/what-is-consuelo.png',
  ],
] as const;

const allStringReplacements = [...slugReplacements, ...imagePathReplacements];

const escapedRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const writeLine = (message: string) => {
  process.stdout.write(`${message}\n`);
};

const getMode = (): Mode => {
  const modeArgument = process.argv.find((argument) =>
    argument.startsWith('--mode='),
  );

  if (!modeArgument) {
    return 'audit';
  }

  const value = modeArgument.replace('--mode=', '');

  if (value === 'apply' || value === 'audit') {
    return value;
  }

  throw new Error(`Unsupported mode: ${value}`);
};

const collectFiles = (directoryPath: string): string[] => {
  if (!fs.existsSync(directoryPath)) {
    return [];
  }

  const directoryEntries = fs.readdirSync(directoryPath, {
    withFileTypes: true,
  });

  return directoryEntries.flatMap((directoryEntry) => {
    const fullPath = path.join(directoryPath, directoryEntry.name);

    if (directoryEntry.isDirectory()) {
      return collectFiles(fullPath);
    }

    const extension = path.extname(directoryEntry.name);

    if (extension !== '.md' && extension !== '.mdx') {
      return [];
    }

    return [fullPath];
  });
};

const collectContentFiles = (): string[] => {
  const rootFiles = contentRoots.flatMap((contentRoot) =>
    collectFiles(path.join(docsRoot, contentRoot)),
  );

  const localeDirectories = fs.existsSync(localesRoot)
    ? fs
        .readdirSync(localesRoot, { withFileTypes: true })
        .filter((directoryEntry) => directoryEntry.isDirectory())
        .map((directoryEntry) => path.join(localesRoot, directoryEntry.name))
    : [];

  const localizedFiles = localeDirectories.flatMap((localeDirectory) =>
    contentRoots.flatMap((contentRoot) =>
      collectFiles(path.join(localeDirectory, contentRoot)),
    ),
  );

  return [...rootFiles, ...localizedFiles].sort();
};

const protectSegments = (content: string) => {
  const placeholders = new Map<string, string>();
  let protectedContent = content;
  let placeholderIndex = 0;

  for (const pattern of protectedPatterns) {
    protectedContent = protectedContent.replace(pattern, (match) => {
      const placeholder = `__CONSUELO_BRAND_PLACEHOLDER_${placeholderIndex}__`;

      placeholders.set(placeholder, match);
      placeholderIndex += 1;

      return placeholder;
    });
  }

  return {
    placeholders,
    protectedContent,
  };
};

const replaceStringLiterals = (content: string): ProcessResult => {
  const { placeholders, protectedContent } = protectSegments(content);

  let replacements = 0;
  let updatedValue = protectedContent;

  for (const [fromValue, toValue] of allStringReplacements) {
    updatedValue = updatedValue.replace(
      new RegExp(escapedRegExp(fromValue), 'g'),
      () => {
        replacements += 1;
        return toValue;
      },
    );
  }

  for (const rule of brandReplacementRules) {
    updatedValue = updatedValue.replace(rule.pattern, () => {
      replacements += 1;
      return rule.replacement;
    });
  }

  for (const [placeholder, originalValue] of placeholders.entries()) {
    updatedValue = updatedValue.split(placeholder).join(originalValue);
  }

  return {
    updatedValue,
    replacements,
  };
};

const replaceStructuredStrings = (value: unknown): StructuredProcessResult => {
  if (typeof value === 'string') {
    const result = replaceStringLiterals(value);

    return {
      updatedValue: result.updatedValue,
      replacements: result.replacements,
    };
  }

  if (Array.isArray(value)) {
    let replacements = 0;

    const updatedValue = value.map((entry) => {
      const result = replaceStructuredStrings(entry);

      replacements += result.replacements;

      return result.updatedValue;
    });

    return {
      updatedValue,
      replacements,
    };
  }

  if (value === null || typeof value !== 'object') {
    return {
      updatedValue: value,
      replacements: 0,
    };
  }

  let replacements = 0;
  const updatedValue = Object.entries(value).reduce<Record<string, unknown>>(
    (accumulator, [key, entryValue]) => {
      const result = replaceStructuredStrings(entryValue);

      replacements += result.replacements;
      accumulator[key] = result.updatedValue;

      return accumulator;
    },
    {},
  );

  return {
    updatedValue,
    replacements,
  };
};

const updateContentFiles = (mode: Mode): FileChange[] => {
  const contentFiles = collectContentFiles();

  return contentFiles.flatMap((filePath) => {
    const originalValue = fs.readFileSync(filePath, 'utf8');
    const result = replaceStringLiterals(originalValue);

    if (result.replacements === 0) {
      return [];
    }

    if (mode === 'apply') {
      fs.writeFileSync(filePath, result.updatedValue);
    }

    return [
      {
        filePath,
        replacements: result.replacements,
        kind: 'content' as const,
      },
    ];
  });
};

const collectJsonFiles = (): string[] => {
  const localeNavigationFiles = fs.existsSync(localesRoot)
    ? fs
        .readdirSync(localesRoot, { withFileTypes: true })
        .filter((directoryEntry) => directoryEntry.isDirectory())
        .map((directoryEntry) =>
          path.join(localesRoot, directoryEntry.name, 'navigation.json'),
        )
        .filter((filePath) => fs.existsSync(filePath))
    : [];

  return [...jsonFiles, ...localeNavigationFiles].sort();
};

const updateJsonFiles = (mode: Mode): FileChange[] => {
  const files = collectJsonFiles();

  return files.flatMap((filePath) => {
    const originalValue = JSON.parse(
      fs.readFileSync(filePath, 'utf8'),
    ) as unknown;
    const result = replaceStructuredStrings(originalValue);

    if (result.replacements === 0) {
      return [];
    }

    if (mode === 'apply') {
      fs.writeFileSync(
        filePath,
        `${JSON.stringify(result.updatedValue, null, 2)}\n`,
      );
    }

    return [
      {
        filePath,
        replacements: result.replacements,
        kind: 'json' as const,
      },
    ];
  });
};

const collectRenameCandidates = (directoryPath: string): string[] => {
  if (!fs.existsSync(directoryPath)) {
    return [];
  }

  const directoryEntries = fs.readdirSync(directoryPath, {
    withFileTypes: true,
  });

  const nestedEntries = directoryEntries.flatMap((directoryEntry) =>
    directoryEntry.isDirectory()
      ? collectRenameCandidates(path.join(directoryPath, directoryEntry.name))
      : [],
  );

  const currentEntry = path.basename(directoryPath);
  const shouldRenameCurrentDirectory = slugReplacements.some(
    ([fromValue]) => currentEntry === fromValue,
  );

  const directoryPathEntry = shouldRenameCurrentDirectory
    ? [directoryPath]
    : [];

  const fileEntries = directoryEntries
    .filter((directoryEntry) => directoryEntry.isFile())
    .map((directoryEntry) => path.join(directoryPath, directoryEntry.name))
    .filter((filePath) => {
      const fileName = path.basename(filePath);
      const relativePath = path.relative(docsRoot, filePath);

      return (
        slugReplacements.some(([fromValue]) => fileName.includes(fromValue)) ||
        imagePathReplacements.some(([fromValue]) => relativePath === fromValue)
      );
    });

  return [...nestedEntries, ...directoryPathEntry, ...fileEntries];
};

const buildRenameChanges = (): RenameChange[] => {
  const renameCandidates = collectRenameCandidates(docsRoot);

  const renameChanges = renameCandidates.map((fromPath) => {
    const toPath = allStringReplacements.reduce(
      (updatedPath, [fromValue, toValue]) => {
        return updatedPath.replace(
          new RegExp(escapedRegExp(fromValue), 'g'),
          toValue,
        );
      },
      fromPath,
    );

    return {
      fromPath,
      toPath,
    };
  });

  return renameChanges
    .filter((renameChange) => renameChange.fromPath !== renameChange.toPath)
    .sort((left, right) => right.fromPath.length - left.fromPath.length);
};

const applyRenames = (mode: Mode): RenameChange[] => {
  const renameChanges = buildRenameChanges().filter((renameChange) =>
    fs.existsSync(renameChange.fromPath),
  );

  if (mode === 'apply') {
    renameChanges.forEach((renameChange) => {
      fs.renameSync(renameChange.fromPath, renameChange.toPath);
    });
  }

  return renameChanges;
};

const printSummary = (
  mode: Mode,
  fileChanges: FileChange[],
  renameChanges: RenameChange[],
) => {
  const totalReplacements = fileChanges.reduce(
    (count, fileChange) => count + fileChange.replacements,
    0,
  );
  const contentFiles = fileChanges.filter(
    (fileChange) => fileChange.kind === 'content',
  );
  const jsonFilesUpdated = fileChanges.filter(
    (fileChange) => fileChange.kind === 'json',
  );

  writeLine(
    `${mode === 'apply' ? 'applied' : 'found'} ${totalReplacements} text replacements across ${fileChanges.length} files.`,
  );
  writeLine(
    `- content files: ${contentFiles.length} (${contentFiles.reduce((count, fileChange) => count + fileChange.replacements, 0)} replacements)`,
  );
  writeLine(
    `- json files: ${jsonFilesUpdated.length} (${jsonFilesUpdated.reduce((count, fileChange) => count + fileChange.replacements, 0)} replacements)`,
  );
  writeLine(`- path renames: ${renameChanges.length}`);

  const previewFiles = fileChanges.slice(0, 12);

  if (previewFiles.length > 0) {
    writeLine('- sample updated files:');

    previewFiles.forEach((fileChange) => {
      writeLine(
        `  - ${path.relative(docsRoot, fileChange.filePath)} (${fileChange.replacements})`,
      );
    });
  }

  const previewRenames = renameChanges.slice(0, 12);

  if (previewRenames.length > 0) {
    writeLine('- sample renames:');

    previewRenames.forEach((renameChange) => {
      writeLine(
        `  - ${path.relative(docsRoot, renameChange.fromPath)} -> ${path.relative(docsRoot, renameChange.toPath)}`,
      );
    });
  }

  if (mode === 'apply') {
    writeLine(
      'next: run `yarn docs:generate-navigation-template && yarn docs:generate` to refresh generated navigation.',
    );
  }
};

const main = () => {
  const mode = getMode();
  const contentChanges = updateContentFiles(mode);
  const jsonChanges = updateJsonFiles(mode);
  const renameChanges = applyRenames(mode);

  printSummary(mode, [...contentChanges, ...jsonChanges], renameChanges);
};

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : 'unknown error';

  process.stderr.write(`${message}\n`);
  process.exit(1);
}
