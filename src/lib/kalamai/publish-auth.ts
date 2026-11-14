import { timingSafeEqual } from "node:crypto";

/** Constant-time check of `Authorization: Bearer <secret>`. Empty secret never authenticates. */
export function tokenMatches(header: string | null, secret: string): boolean {
  if (!secret) return false;
  const m = /^Bearer (.+)$/.exec(header ?? "");
  if (!m) return false;
  const a = Buffer.from(m[1]);
  const b = Buffer.from(secret);
  // timingSafeEqual throws on unequal lengths; length alone is not secret enough to matter here.
  return a.length === b.length && timingSafeEqual(a, b);
}
