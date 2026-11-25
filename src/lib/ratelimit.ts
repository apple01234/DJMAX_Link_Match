import "server-only";
import { DraftError } from "./repo";

/**
 * 단일 프로세스용 고정 윈도 레이트 리미터 (주장 코드·관리자 토큰 대입 공격 방지).
 * 여러 인스턴스로 확장하면 공유 저장소(예: Redis, Cloudflare KV/DO)로 교체해야 한다.
 */
interface Bucket {
  count: number;
  resetAt: number;
}

declare global {
  var __linkmatchRate: Map<string, Bucket> | undefined;
}

const store = (globalThis.__linkmatchRate ??= new Map<string, Bucket>());

/**
 * 클라이언트 식별자.
 * 프록시 헤더는 클라이언트가 위조할 수 있으므로, 신뢰할 수 있는 프록시
 * (Cloudflare, Vercel, nginx 등이 값을 덮어쓰는 환경) 뒤에서 TRUST_PROXY=1로 켰을 때만 쓴다.
 * 그 외에는 모든 요청을 한 버킷으로 묶는다: 대입 공격은 확실히 막고, 대신 한도를 넉넉히 둔다.
 */
export function clientKey(req: Request): string {
  if (process.env.TRUST_PROXY !== "1") return "direct";
  const ip =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (ip || "unknown").slice(0, 64);
}

function bucket(key: string, windowMs: number, now: number): Bucket {
  let b = store.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs };
    store.set(key, b);
  }
  if (store.size > 10_000) {
    for (const [k, v] of store) if (v.resetAt <= now) store.delete(k);
  }
  return b;
}

/** 한도를 넘었으면 429를 던진다. */
export function assertNotLimited(key: string, limit: number, windowMs: number, now = Date.now()) {
  const b = bucket(key, windowMs, now);
  if (b.count >= limit) {
    const sec = Math.ceil((b.resetAt - now) / 1000);
    throw new DraftError(429, `시도 횟수가 너무 많습니다. ${sec}초 후에 다시 시도하세요.`);
  }
}

export function hit(key: string, windowMs: number, now = Date.now()) {
  bucket(key, windowMs, now).count++;
}

export function clear(key: string) {
  store.delete(key);
}

/** 인증 실패만 세는 헬퍼: 실패하면 카운트 +1, 성공하면 초기화. */
export async function guardAuth<T>(key: string, limit: number, windowMs: number, fn: () => T | Promise<T>): Promise<T> {
  assertNotLimited(key, limit, windowMs);
  try {
    const out = await fn();
    clear(key);
    return out;
  } catch (e) {
    // 401(코드·토큰 불일치)만 센다. 403(차례 아님) 같은 정상 사용자의 실수는 세지 않는다.
    if (e instanceof DraftError && e.status === 401) hit(key, windowMs);
    throw e;
  }
}
