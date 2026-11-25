import { captainPick } from "@/lib/repo";
import { handle, int, readBody, str } from "@/lib/http";
import { assertNotLimited, clientKey, guardAuth, hit } from "@/lib/ratelimit";

export async function POST(req: Request) {
  return handle(async () => {
    const ip = clientKey(req);
    // 전체 지명 요청: IP당 1분에 60회
    assertNotLimited(`pick:${ip}`, 60, 60_000);
    hit(`pick:${ip}`, 60_000);
    const body = await readBody(req);
    const playerId = int(body.playerId, "선수 ID");
    // 코드 대입은 로그인과 같은 버킷으로 센다
    return guardAuth(`captain:${ip}`, 10, 10 * 60_000, () => captainPick(str(body.code), playerId));
  });
}
