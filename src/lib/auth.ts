import "server-only";
import { timingSafeEqual } from "node:crypto";

function adminToken(): string | null {
  if (process.env.ADMIN_TOKEN) return process.env.ADMIN_TOKEN;
  // 개발 모드 편의용 기본값. 프로덕션에서 ADMIN_TOKEN이 없으면 관리자 API를 막는다.
  return process.env.NODE_ENV === "production" ? null : "dev-admin";
}

export function isAdmin(req: Request): boolean {
  const expected = adminToken();
  const given = req.headers.get("x-admin-token");
  if (!expected || !given) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}
