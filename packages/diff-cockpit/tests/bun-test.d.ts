declare module 'bun:test' {
  type TestBody = () => void | Promise<void>;
  type Matchers = {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toMatchObject(expected: Record<string, unknown>): void;
    toContain(expected: string): void;
    toHaveLength(expected: number): void;
    toBeLessThan(expected: number): void;
    toThrow(expected?: string | RegExp): void;
  };
  type PromiseMatchers = {
    toThrow(expected?: string | RegExp): Promise<void>;
  };
  export function describe(name: string, body: TestBody): void;
  export function test(name: string, body: TestBody): void;
  export function expect(value: unknown): Matchers & { rejects: PromiseMatchers; not: Matchers };
}
