/**
 * Canonical JSON (T12, docs/protocol.md §2): one value has exactly one byte form,
 * so the CLI and the platform sign and verify the same bytes.
 *
 * Rules:
 *   - objects: keys sorted by UTF-16 code unit (plain JavaScript string order), no duplicates;
 *   - no whitespace anywhere; output is UTF-8;
 *   - strings: escaped exactly as JSON.stringify does; a lone surrogate is refused;
 *   - numbers: safe integers only (no fractions, no exponent, no -0, no NaN or Infinity);
 *   - allowed values: null, true, false, integer, string, array, plain object;
 *   - refused: undefined, functions, symbols, bigint, Date, Map, class instances, sparse arrays.
 *
 * Pure: no Node-only API, so it runs in the CLI and on the Next.js server alike.
 */

export class CanonicalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CanonicalError";
  }
}

const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

function text(value: string, path: string): string {
  if (LONE_SURROGATE.test(value)) throw new CanonicalError(`${path}: a string holds a lone surrogate (not valid UTF-8)`);
  return JSON.stringify(value);
}

function write(value: unknown, path: string, seen: Set<object>): string {
  if (value === null) return "null";
  if (value === true) return "true";
  if (value === false) return "false";
  if (typeof value === "string") return text(value, path);
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new CanonicalError(`${path}: only safe integers are allowed (got ${String(value)})`);
    if (Object.is(value, -0)) throw new CanonicalError(`${path}: -0 is not allowed`);
    return String(value);
  }
  if (typeof value !== "object") throw new CanonicalError(`${path}: a ${typeof value} cannot be written`);
  if (seen.has(value)) throw new CanonicalError(`${path}: the value refers to itself`);
  seen.add(value);
  let out: string;
  if (Array.isArray(value)) {
    const parts: string[] = [];
    for (let i = 0; i < value.length; i++) {
      if (!(i in value)) throw new CanonicalError(`${path}[${i}]: a missing array item is not allowed`);
      parts.push(write(value[i], `${path}[${i}]`, seen));
    }
    out = `[${parts.join(",")}]`;
  } else {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) throw new CanonicalError(`${path}: only plain objects are allowed`);
    if (Object.getOwnPropertySymbols(value).length > 0) throw new CanonicalError(`${path}: symbol keys are not allowed`);
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    out = `{${keys.map((key) => `${text(key, `${path}.${key}`)}:${write(record[key], `${path}.${key}`, seen)}`).join(",")}}`;
  }
  seen.delete(value);
  return out;
}

/** The canonical text of a value. Throws CanonicalError for anything the rules refuse. */
export function canonicalize(value: unknown): string {
  return write(value, "$", new Set());
}

/** The canonical bytes (UTF-8) of a value. */
export function canonicalBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(canonicalize(value));
}

/**
 * Parse text that MUST already be canonical. Anything else is refused:
 * extra whitespace, keys in another order, a duplicate key, a fraction, a
 * non-standard escape. This is how a receiver makes sure the bytes it verifies
 * are the bytes it then reads.
 */
export function parseCanonical(input: string): unknown {
  let value: unknown;
  try {
    value = JSON.parse(input);
  } catch {
    throw new CanonicalError("not valid JSON");
  }
  let again: string;
  try {
    again = canonicalize(value);
  } catch (error) {
    throw new CanonicalError(`not canonical: ${(error as Error).message}`);
  }
  if (again !== input) throw new CanonicalError("not canonical: the text is not in the one allowed form (key order, whitespace, duplicate key or number form)");
  return value;
}
