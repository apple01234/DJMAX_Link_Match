import { captainPick } from "@/lib/repo";
import { handle, int, readBody, str } from "@/lib/http";
import { assertNotLimited, clientKey, guardAuth, hit } from "@/lib/ratelimit";

export async function POST(req: Request) {
  return handle(async () => {
    const ip = clientKey(req);
    // 전체 지명 요청: IP당 1분에 60회
    await assertNotLimited(`pick:${ip}`, 60, 60_000);
    await hit(`pick:${ip}`, 60_000);
    const body = await readBody(req);
    const playerId = int(body.playerId, "선수 ID");
    // 확인 창을 연 시점의 차례 번호 (선택). 보내면 그 사이 차례가 바뀐 지명을 거절한다
    const pickNo = body.pickNo === undefined ? undefined : int(body.pickNo, "차례 번호");
    // 코드 대입은 로그인과 같은 버킷으로 센다
    return guardAuth(`captain:${ip}`, 10, 10 * 60_000, () => captainPick(str(body.code), playerId, Date.now(), pickNo));
  });
}
