import { getPublicState, stateVersion } from "@/lib/repo";
import { handle } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * 드래프트 보드가 폴링하는 공개 상태. 주장 코드는 포함하지 않는다.
 * 상태가 바뀔 때마다 draft.version이 오르므로 이를 ETag로 쓴다. 브라우저가 같은 버전을 갖고 있으면
 * 행 하나만 읽고 304로 끝낸다 (관전자가 많아도 DB·전송량이 거의 늘지 않게).
 */
export function GET(req: Request) {
  return handle(async () => {
    const v = await stateVersion();
    const etag = v === null ? null : `"v${v}"`;
    if (etag && req.headers.get("if-none-match") === etag) {
      return new Response(null, { status: 304, headers: { etag, "cache-control": "no-store" } });
    }
    const s = await getPublicState();
    return Response.json(s, { headers: { etag: `"v${s.draft.version}"`, "cache-control": "no-store" } });
  });
}
