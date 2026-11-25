import { captainLogin } from "@/lib/repo";
import { handle, readBody, str } from "@/lib/http";
import { clientKey, guardAuth } from "@/lib/ratelimit";

export async function POST(req: Request) {
  return handle(async () => {
    const body = await readBody(req);
    // 6자리 주장 코드 대입 방지: IP당 10분에 실패 10회
    const team = await guardAuth(`captain:${clientKey(req)}`, 10, 10 * 60_000, () => captainLogin(str(body.code)));
    return { team };
  });
}
