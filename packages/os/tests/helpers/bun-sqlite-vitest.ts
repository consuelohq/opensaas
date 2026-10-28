import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

type BunDatabaseOptions = {
  create?: boolean;
  readonly?: boolean;
  readwrite?: boolean;
  strict?: boolean;
};

type TransactionFn<Args extends unknown[], Result> = ((...args: Args) => Result) & {
  deferred: (...args: Args) => Result;
  immediate: (...args: Args) => Result;
  exclusive: (...args: Args) => Result;
};

export type SQLQueryBindings = SQLInputValue;

export class Database {
  readonly #database: DatabaseSync;

  constructor(path: string, options: BunDatabaseOptions = {}) {
    this.#database = new DatabaseSync(path, {
      readOnly: options.readonly === true,
    });
  }

  exec(sql: string): void {
    this.#database.exec(sql);
  }

  query(sql: string) {
    return this.#database.prepare(sql);
  }

  prepare(sql: string) {
    return this.#database.prepare(sql);
  }

  close(): void {
    this.#database.close();
  }

  loadExtension(path: string): void {
    this.#database.loadExtension(path);
  }

  transaction<Args extends unknown[], Result>(
    callback: (...args: Args) => Result,
  ): TransactionFn<Args, Result> {
    const run = (mode: '' | ' DEFERRED' | ' IMMEDIATE' | ' EXCLUSIVE', args: Args): Result => {
      this.#database.exec(`BEGIN${mode};`);
      try {
        const result = callback(...args);
        this.#database.exec('COMMIT;');
        return result;
      } catch (error: unknown) {
        try {
          this.#database.exec('ROLLBACK;');
        } catch {
          // Preserve the original callback/database error.
        }
        throw error;
      }
    };
    const transaction = ((...args: Args) => run(' IMMEDIATE', args)) as TransactionFn<Args, Result>;
    transaction.deferred = (...args: Args) => run(' DEFERRED', args);
    transaction.immediate = (...args: Args) => run(' IMMEDIATE', args);
    transaction.exclusive = (...args: Args) => run(' EXCLUSIVE', args);
    return transaction;
  }
}
