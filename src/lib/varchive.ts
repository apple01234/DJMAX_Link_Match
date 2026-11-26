import "server-only";

/**
 * V-ARCHIVE 공개 API (https://github.com/djmax-in/openapi) — 유저 티어 조회 V2.
 * 개인이 운영하는 API라 언제든 바뀌거나 멈출 수 있고, 동시에 2개 이상 부르면 429가 날 수 있다.
 * 그래서 호출하는 쪽은 반드시 한 번에 하나씩 차례로 부른다.
 */
const BASE = "https://v-archive.net/api/v2/archive";

/** 티어 점수(tierPoint). 유저나 해당 버튼 기록이 없으면 "notFound", 그 밖의 실패는 "error". */
export async function fetchTierPoint(nickname: string, button = 8): Promise<number | "notFound" | "error"> {
  if (nickname === "." || nickname === "..") return "notFound"; // 경로로 해석되는 이름은 조회하지 않는다
  try {
    const res = await fetch(`${BASE}/${encodeURIComponent(nickname)}/tier/${button}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const body = (await res.json().catch(() => null)) as { success?: boolean; tierPoint?: unknown; errorCode?: number } | null;
    if (res.ok && body?.success && typeof body.tierPoint === "number" && Number.isFinite(body.tierPoint)) {
      return body.tierPoint;
    }
    // 101: 유저 없음, 111: 그 버튼의 티어 기록 없음
    if (body?.errorCode === 101 || body?.errorCode === 111) return "notFound";
    return "error";
  } catch {
    return "error";
  }
}
