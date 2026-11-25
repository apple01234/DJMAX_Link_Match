import "server-only";
import { DraftError } from "./repo";

/** 요청 본문 상한. 일괄 등록 텍스트(최대 200줄)가 충분히 들어가는 크기. */
const MAX_BODY_BYTES = 64 * 1024;

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "cache-control": "no-store" } });
}

export async function readBody(req: Request): Promise<Record<string, unknown>> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) throw new DraftError(413, "요청이 너무 큽니다.");
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) throw new DraftError(413, "요청이 너무 큽니다.");
  try {
    const body = JSON.parse(raw);
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** 안전한 정수만 허용. 아니면 400. */
export function int(v: unknown, label = "값"): number {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  if (!Number.isSafeInteger(n)) throw new DraftError(400, `${label}이(가) 올바른 정수가 아닙니다.`);
  return n;
}

/** 라우트 핸들러 공통 에러 처리 */
export async function handle(fn: () => unknown): Promise<Response> {
  try {
    return json(await fn());
  } catch (err) {
    if (err instanceof DraftError) return json({ error: err.message }, err.status);
    if (err instanceof Error && /UNIQUE constraint failed/.test(err.message)) {
      return json({ error: "이미 존재하는 이름입니다. (팀명·닉네임은 중복될 수 없습니다)" }, 409);
    }
    console.error(err);
    return json({ error: "서버 오류가 발생했습니다." }, 500);
  }
}
