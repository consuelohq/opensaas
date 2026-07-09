import fs from 'node:fs';
import path from 'node:path';

import { Effect } from 'effect';

export type WriteMode = 'create' | 'overwrite' | 'append';

export type FsWriteErrorCode =
  | 'INVALID_CONTENT_SOURCE'
  | 'INVALID_WRITE_MODE'
  | 'PATH_OUTSIDE_ROOT'
  | 'PARENT_MISSING'
  | 'PARENT_NOT_DIRECTORY'
  | 'FILE_EXISTS'
  | 'CONTENT_FILE_NOT_FOUND'
  | 'CONTENT_FILE_NOT_FILE'
  | 'CONTENT_FILE_NOT_READABLE'
  | 'WRITE_FAILED';

export type FsWriteInput = {
  path: string;
  content: string;
  force?: boolean;
  append?: boolean;
  mkdirs?: boolean;
};

export type FsWriteSuccess = {
  ok: true;
  operation: 'write' | 'append';
  path: string;
  resolvedPath?: string;
  existed: boolean;
  bytes: number;
  lines: number;
  createdParents?: boolean;
};

export type FsWriteError = {
  ok: false;
  type: 'error';
  code: FsWriteErrorCode;
  path?: string;
  message: string;
};

export type FsWriteResult = FsWriteSuccess | FsWriteError;

type ParentResolution = {
  parentPath: string;
  parentRealPath: string;
  createdParents: boolean;
};

type ResolvedWriteTarget = {
  inputPath: string;
  displayPath: string;
  absolutePath: string;
  writePath: string;
  parentRealPath: string;
  rootRealPath: string;
  existed: boolean;
  createdParents: boolean;
};

const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);

function causeMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

function writeError(code: FsWriteErrorCode, message: string, inputPath?: string): FsWriteError {
  return { ok: false, type: 'error', code, ...(inputPath ? { path: inputPath } : {}), message };
}

function containsPath(rootPath: string, candidatePath: string): boolean {
  const relative = path.relative(rootPath, candidatePath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function displayPath(inputPath: string, rootRealPath: string, absolutePath: string): string {
  if (!path.isAbsolute(inputPath)) return inputPath.replace(/^\.\//, '');
  if (containsPath(rootRealPath, absolutePath)) return path.relative(rootRealPath, absolutePath) || path.basename(absolutePath);
  return inputPath;
}

function countLines(content: string): number {
  if (content.length === 0) return 0;
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').length;
}

function hasUtf8Bom(bytes: Buffer): boolean {
  return bytes.length >= UTF8_BOM.length && bytes.subarray(0, UTF8_BOM.length).equals(UTF8_BOM);
}

function contentBuffer(content: string, preserveBom: boolean): Buffer {
  if (!preserveBom || content.startsWith('\ufeff')) return Buffer.from(content, 'utf8');
  return Buffer.concat([UTF8_BOM, Buffer.from(content, 'utf8')]);
}

function tempPathFor(targetPath: string): string {
  return path.join(
    path.dirname(targetPath),
    `.fs-write-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.tmp`,
  );
}

function determineMode(input: FsWriteInput, existed: boolean): WriteMode | FsWriteError {
  if (input.force === true && input.append === true) {
    return writeError('INVALID_WRITE_MODE', '--force and --append are conflicting write modes', input.path);
  }
  if (input.append === true) return 'append';
  if (!existed) return 'create';
  if (input.force === true) return 'overwrite';
  return writeError('FILE_EXISTS', `${input.path} already exists. Use --force to overwrite or --append to add.`, input.path);
}

function findExistingAncestor(candidatePath: string, rootRealPath: string): string | FsWriteError {
  let current = candidatePath;
  while (!fs.existsSync(current)) {
    const next = path.dirname(current);
    if (next === current) break;
    current = next;
  }
  if (!containsPath(rootRealPath, current)) {
    return writeError('PATH_OUTSIDE_ROOT', `Path escapes the allowed root: ${candidatePath}`);
  }
  return current;
}

const ensureParentEffect = (parentPath: string, input: FsWriteInput, rootRealPath: string) => Effect.gen(function* () {
  if (!containsPath(rootRealPath, parentPath)) {
    return yield* Effect.fail(writeError('PATH_OUTSIDE_ROOT', `Path escapes the allowed root: ${input.path}`, input.path));
  }

  if (!fs.existsSync(parentPath)) {
    if (input.mkdirs !== true) {
      return yield* Effect.fail(writeError('PARENT_MISSING', `Parent directory does not exist for ${input.path}. Use --mkdirs to create it.`, input.path));
    }

    const ancestor = findExistingAncestor(parentPath, rootRealPath);
    if (typeof ancestor !== 'string') return yield* Effect.fail(ancestor);

    const ancestorRealPath = yield* Effect.try({
      try: () => fs.realpathSync(ancestor),
      catch: (cause) => writeError('PARENT_MISSING', `Parent directory is not readable for ${input.path}: ${causeMessage(cause)}`, input.path),
    });
    if (!containsPath(rootRealPath, ancestorRealPath)) {
      return yield* Effect.fail(writeError('PATH_OUTSIDE_ROOT', `Parent directory resolves outside the allowed root: ${input.path}`, input.path));
    }
    const ancestorStats = yield* Effect.try({
      try: () => fs.statSync(ancestorRealPath),
      catch: (cause) => writeError('PARENT_MISSING', `Parent directory is not readable for ${input.path}: ${causeMessage(cause)}`, input.path),
    });
    if (!ancestorStats.isDirectory()) {
      return yield* Effect.fail(writeError('PARENT_NOT_DIRECTORY', `Parent path is not a directory: ${ancestor}`, input.path));
    }

    yield* Effect.try({
      try: () => fs.mkdirSync(parentPath, { recursive: true }),
      catch: (cause) => writeError('WRITE_FAILED', `Failed to create parent directories for ${input.path}: ${causeMessage(cause)}`, input.path),
    });

    const parentRealPath = yield* Effect.try({
      try: () => fs.realpathSync(parentPath),
      catch: (cause) => writeError('PARENT_MISSING', `Parent directory is not readable for ${input.path}: ${causeMessage(cause)}`, input.path),
    });
    if (!containsPath(rootRealPath, parentRealPath)) {
      return yield* Effect.fail(writeError('PATH_OUTSIDE_ROOT', `Parent directory resolves outside the allowed root: ${input.path}`, input.path));
    }
    return { parentPath, parentRealPath, createdParents: true } satisfies ParentResolution;
  }

  const parentRealPath = yield* Effect.try({
    try: () => fs.realpathSync(parentPath),
    catch: (cause) => writeError('PARENT_MISSING', `Parent directory is not readable for ${input.path}: ${causeMessage(cause)}`, input.path),
  });
  if (!containsPath(rootRealPath, parentRealPath)) {
    return yield* Effect.fail(writeError('PATH_OUTSIDE_ROOT', `Parent directory resolves outside the allowed root: ${input.path}`, input.path));
  }
  const parentStats = yield* Effect.try({
    try: () => fs.statSync(parentRealPath),
    catch: (cause) => writeError('PARENT_MISSING', `Parent directory is not readable for ${input.path}: ${causeMessage(cause)}`, input.path),
  });
  if (!parentStats.isDirectory()) {
    return yield* Effect.fail(writeError('PARENT_NOT_DIRECTORY', `Parent path is not a directory: ${path.dirname(input.path)}`, input.path));
  }

  return { parentPath, parentRealPath, createdParents: false } satisfies ParentResolution;
});

const resolveWriteTargetEffect = (input: FsWriteInput, root: string) => Effect.gen(function* () {
  if (typeof input.content !== 'string') {
    return yield* Effect.fail(writeError('INVALID_CONTENT_SOURCE', 'write content must be a string', input.path));
  }

  const rootRealPath = yield* Effect.try({
    try: () => fs.realpathSync(root),
    catch: (cause) => writeError('WRITE_FAILED', `Root is not readable: ${causeMessage(cause)}`),
  });

  const absolutePath = path.isAbsolute(input.path) ? path.resolve(input.path) : path.resolve(rootRealPath, input.path);
  if (!containsPath(rootRealPath, absolutePath)) {
    return yield* Effect.fail(writeError('PATH_OUTSIDE_ROOT', `Path escapes the allowed root: ${input.path}`, input.path));
  }

  if (fs.existsSync(absolutePath)) {
    const realPath = yield* Effect.try({
      try: () => fs.realpathSync(absolutePath),
      catch: (cause) => writeError('WRITE_FAILED', `Path is not writable: ${input.path}: ${causeMessage(cause)}`, input.path),
    });
    if (!containsPath(rootRealPath, realPath)) {
      return yield* Effect.fail(writeError('PATH_OUTSIDE_ROOT', `Path resolves outside the allowed root: ${input.path}`, input.path));
    }
    const stats = yield* Effect.try({
      try: () => fs.statSync(realPath),
      catch: (cause) => writeError('WRITE_FAILED', `Path is not writable: ${input.path}: ${causeMessage(cause)}`, input.path),
    });
    if (!stats.isFile()) {
      return yield* Effect.fail(writeError('WRITE_FAILED', `Path is not a regular file: ${input.path}`, input.path));
    }
    const parent = yield* ensureParentEffect(path.dirname(realPath), input, rootRealPath);
    return {
      inputPath: input.path,
      displayPath: displayPath(input.path, rootRealPath, absolutePath),
      absolutePath,
      writePath: realPath,
      parentRealPath: parent.parentRealPath,
      rootRealPath,
      existed: true,
      createdParents: parent.createdParents,
    } satisfies ResolvedWriteTarget;
  }

  const parent = yield* ensureParentEffect(path.dirname(absolutePath), input, rootRealPath);
  return {
    inputPath: input.path,
    displayPath: displayPath(input.path, rootRealPath, absolutePath),
    absolutePath,
    writePath: absolutePath,
    parentRealPath: parent.parentRealPath,
    rootRealPath,
    existed: false,
    createdParents: parent.createdParents,
  } satisfies ResolvedWriteTarget;
});

const readExistingBomEffect = (target: ResolvedWriteTarget, mode: WriteMode) => Effect.try({
  try: () => {
    if (mode !== 'overwrite') return false;
    const fd = fs.openSync(target.writePath, 'r');
    try {
      const bytes = Buffer.alloc(UTF8_BOM.length);
      const bytesRead = fs.readSync(fd, bytes, 0, UTF8_BOM.length, 0);
      return bytesRead === UTF8_BOM.length && hasUtf8Bom(bytes);
    } finally {
      fs.closeSync(fd);
    }
  },
  catch: (cause) => writeError('WRITE_FAILED', `Failed to inspect existing file ${target.displayPath}: ${causeMessage(cause)}`, target.displayPath),
});

const atomicWriteEffect = (target: ResolvedWriteTarget, bytes: Buffer) => Effect.try({
  try: () => {
    const tempPath = tempPathFor(target.writePath);
    try {
      fs.writeFileSync(tempPath, bytes);
      fs.renameSync(tempPath, target.writePath);
    } finally {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }
  },
  catch: (cause) => writeError('WRITE_FAILED', `Failed to write ${target.displayPath}: ${causeMessage(cause)}`, target.displayPath),
});

const appendEffect = (target: ResolvedWriteTarget, bytes: Buffer) => Effect.try({
  try: () => fs.appendFileSync(target.writePath, bytes),
  catch: (cause) => writeError('WRITE_FAILED', `Failed to append ${target.displayPath}: ${causeMessage(cause)}`, target.displayPath),
});

export const writeFileEffect = (input: FsWriteInput, options: { root?: string } = {}) => Effect.gen(function* () {
  const root = options.root || process.cwd();
  const target = yield* resolveWriteTargetEffect(input, root);
  const mode = determineMode(input, target.existed);
  if (typeof mode !== 'string') return yield* Effect.fail(mode);

  const preserveBom = yield* readExistingBomEffect(target, mode);
  const bytes = contentBuffer(input.content, preserveBom);

  if (mode === 'append') yield* appendEffect(target, bytes);
  else yield* atomicWriteEffect(target, bytes);

  return {
    ok: true,
    operation: mode === 'append' ? 'append' : 'write',
    path: target.displayPath,
    resolvedPath: target.writePath,
    existed: target.existed,
    bytes: bytes.byteLength,
    lines: countLines(input.content),
    ...(target.createdParents ? { createdParents: true } : {}),
  } satisfies FsWriteSuccess;
}).pipe(Effect.catchAll((failure) => Effect.succeed(failure as FsWriteError)));

export const readContentFileEffect = (contentFile: string, options: { cwd?: string } = {}) => Effect.gen(function* () {
  const contentPath = path.isAbsolute(contentFile)
    ? path.resolve(contentFile)
    : path.resolve(options.cwd || process.cwd(), contentFile);

  if (!fs.existsSync(contentPath)) {
    return yield* Effect.fail(writeError('CONTENT_FILE_NOT_FOUND', `Content file not found: ${contentFile}`, contentFile));
  }

  const stats = yield* Effect.try({
    try: () => fs.statSync(contentPath),
    catch: (cause) => writeError('CONTENT_FILE_NOT_READABLE', `Content file is not readable: ${contentFile}: ${causeMessage(cause)}`, contentFile),
  });
  if (!stats.isFile()) {
    return yield* Effect.fail(writeError('CONTENT_FILE_NOT_FILE', `Content file must be a regular file: ${contentFile}`, contentFile));
  }

  yield* Effect.try({
    try: () => fs.accessSync(contentPath, fs.constants.R_OK),
    catch: (cause) => writeError('CONTENT_FILE_NOT_READABLE', `Content file is not readable: ${contentFile}: ${causeMessage(cause)}`, contentFile),
  });

  return yield* Effect.try({
    try: () => fs.readFileSync(contentPath, 'utf8'),
    catch: (cause) => writeError('CONTENT_FILE_NOT_READABLE', `Content file is not readable: ${contentFile}: ${causeMessage(cause)}`, contentFile),
  });
}).pipe(Effect.catchAll((failure) => Effect.succeed(failure as FsWriteError)));

export function writeFileForCli(input: FsWriteInput, options: { root?: string } = {}): Promise<FsWriteResult> {
  return Effect.runPromise(writeFileEffect(input, options));
}

export function readContentFileForCli(contentFile: string, options: { cwd?: string } = {}): Promise<string | FsWriteError> {
  return Effect.runPromise(readContentFileEffect(contentFile, options));
}
