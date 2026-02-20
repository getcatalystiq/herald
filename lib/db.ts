import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let _sql: NeonQueryFunction<false, false> | null = null;

export function getDb(): NeonQueryFunction<false, false> {
  if (!_sql) {
    _sql = neon(process.env.DATABASE_URL!);
  }
  return _sql;
}

// Convenience export — use sql`...` template literals
export const sql = new Proxy({} as NeonQueryFunction<false, false>, {
  apply(_target, _thisArg, args) {
    return getDb().apply(null, args as Parameters<NeonQueryFunction<false, false>>);
  },
  get(_target, prop) {
    return Reflect.get(getDb(), prop);
  },
});
