import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let _sql: NeonQueryFunction<false, false> | null = null;

export function getDb(): NeonQueryFunction<false, false> {
  if (!_sql) {
    _sql = neon(process.env.DATABASE_URL!);
  }
  return _sql;
}

// Lazy-initialized tagged template — use sql`...`
// Using a function target so the Proxy's apply trap works
export const sql: NeonQueryFunction<false, false> = new Proxy(
  Object.assign(function () {} as unknown as NeonQueryFunction<false, false>),
  {
    apply(_target, _thisArg, args) {
      return getDb().apply(
        null,
        args as Parameters<NeonQueryFunction<false, false>>
      );
    },
    get(_target, prop) {
      return Reflect.get(getDb(), prop);
    },
  }
);
