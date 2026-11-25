import { getPublicState } from "@/lib/repo";
import { handle } from "@/lib/http";

export const dynamic = "force-dynamic";

/** 드래프트 보드가 폴링하는 공개 상태. 주장 코드는 포함하지 않는다. */
export function GET() {
  return handle(() => getPublicState());
}
