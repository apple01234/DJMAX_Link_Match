import "server-only";
import { createHmac } from "node:crypto";
import { get, query } from "./db";
import { DraftError } from "./repo";

/**
 * 고정 윈도 레이트 리미터 (주장 코드·관리자 토큰 대입 공격 방지).
 * 서버리스(Vercel)에서는 인스턴스가 여러 개 뜨므로 카운터를 DB(rate_limits)에 둔다.
 */

/**
 * 클라이언트 식별자.
 * 프록시 헤더는 클라이언트가 위조할 수 있으므로 값을 덮어쓰는 것이 확실한 헤더만 쓴다.
 *  - Vercel: x-real-ip / x-forwarded-for 를 Vercel이 실제 접속 IP로 덮어쓴다.
 *    (cf-connecting-ip 같은 다른 헤더는 그대로 통과하므로 읽지 않는다)
 *  - 그 외: 신뢰할 수 있는 프록시 뒤에서 TRUST_PROXY=1로 켰을 때만 헤더를 쓴다.
 * 둘 다 아니면 모든 요청을 한 버킷으로 묶는다.
 */
export function clientKey(req: Request): string {
  if (process.env.VERCEL === "1") {
    const ip = req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    return (ip || "unknown").slice(0, 64);
  }
  if (process.env.TRUST_PROXY !== "1") return "direct";
  const ip =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (ip || "unknown").slice(0, 64);
}

/**
 * DB에는 접속 IP를 그대로 남기지 않는다. 키(예: "captain:1.2.3.4")를 비밀값으로 HMAC해 저장하므로
 * DB를 보더라도 IP를 되돌릴 수 없다. (IPv4는 범위가 좁아 비밀값 없는 해시는 전수 대입으로 풀린다)
 */
function hashKey(key: string): string {
  const secret = process.env.ADMIN_TOKEN || "dev-rate-limit";
  return createHmac("sha256", secret).update(key).digest("base64url");
}

/** 한도를 넘었으면 429를 던진다. */
export async function assertNotLimited(key: string, limit: number, _windowMs: number, now = Date.now()) {
  const b = await get<{ count: number; reset_at: number }>(
    "SELECT count, reset_at FROM rate_limits WHERE key = $1",
    hashKey(key),
  );
  if (b && b.reset_at > now && b.count >= limit) {
    const sec = Math.ceil((b.reset_at - now) / 1000);
    throw new DraftError(429, `시도 횟수가 너무 많습니다. ${sec}초 후에 다시 시도하세요.`);
  }
}

export async function hit(key: string, windowMs: number, now = Date.now()) {
  // 창이 지났으면 1부터 다시, 아니면 +1 (한 문장으로 처리해 동시 요청에도 정확하다)
  await query(
    `INSERT INTO rate_limits (key, count, reset_at) VALUES ($1, 1, $2)
     ON CONFLICT (key) DO UPDATE SET
       count    = CASE WHEN rate_limits.reset_at <= $3 THEN 1  ELSE rate_limits.count + 1 END,
       reset_at = CASE WHEN rate_limits.reset_at <= $3 THEN $2 ELSE rate_limits.reset_at END`,
    [hashKey(key), now + windowMs, now],
  );
  // 창이 끝난 기록은 바로 지운다 (개인정보 안내: 최대 10분 보관)
  await query("DELETE FROM rate_limits WHERE reset_at < $1", [now]);
}

export async function clear(key: string) {
  await query("DELETE FROM rate_limits WHERE key = $1", [hashKey(key)]);
}

/** 인증 실패만 세는 헬퍼: 실패하면 카운트 +1, 성공하면 초기화. */
export async function guardAuth<T>(key: string, limit: number, windowMs: number, fn: () => T | Promise<T>): Promise<T> {
  await assertNotLimited(key, limit, windowMs);
  try {
    const out = await fn();
    await clear(key);
    return out;
  } catch (e) {
    // 401(코드·토큰 불일치)만 센다. 403(차례 아님) 같은 정상 사용자의 실수는 세지 않는다.
    if (e instanceof DraftError && e.status === 401) await hit(key, windowMs);
    throw e;
  }
}
