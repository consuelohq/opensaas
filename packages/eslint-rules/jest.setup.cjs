function cloneForRuleTester(value, seen = new WeakMap()) {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return seen.get(value);

  const values = Reflect.ownKeys(value).map((key) => value[key]);
  if (values.some((entry) => typeof entry === 'function')) return value;

  if (Array.isArray(value)) {
    const clone = [];
    seen.set(value, clone);
    for (const entry of value) clone.push(cloneForRuleTester(entry, seen));
    return clone;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return value;

  const clone = Object.create(prototype);
  seen.set(value, clone);
  for (const key of Reflect.ownKeys(value)) {
    clone[key] = cloneForRuleTester(value[key], seen);
  }
  return clone;
}

if (typeof globalThis.structuredClone !== 'function') {
  globalThis.structuredClone = cloneForRuleTester;
}
