import { isAdmin } from "@/lib/auth";
import { handle, int, readBody, str } from "@/lib/http";
import { clientKey, guardAuth } from "@/lib/ratelimit";
import * as repo from "@/lib/repo";
import { DraftError } from "@/lib/repo";

export const dynamic = "force-dynamic";
// V-ARCHIVE 레이팅 불러오기는 선수를 한 명씩 조회하므로 오래 걸릴 수 있다 (repo.importRatings는 45초에서 멈춘다)
export const maxDuration = 60;

/** 모든 관리자 요청은 서버에서 토큰을 검증한다. 실패는 IP당 10분에 10회까지. */
function requireAdmin(req: Request) {
  return guardAuth(`admin:${clientKey(req)}`, 10, 10 * 60_000, () => {
    if (!isAdmin(req)) throw new DraftError(401, "관리자 토큰이 올바르지 않습니다.");
  });
}

export function GET(req: Request) {
  return handle(async () => {
    await requireAdmin(req);
    return repo.getAdminState();
  });
}

/** 관리자 액션은 하나의 엔드포인트에서 { action, ...payload } 형태로 받는다. */
export async function POST(req: Request) {
  return handle(async () => {
    await requireAdmin(req);
    const body = await readBody(req);
    if (str(body.action) === "importRatings") {
      const message = await repo.importRatings();
      return { ...(await repo.getAdminState()), message };
    }
    switch (str(body.action)) {
      case "addTeams":     await repo.addTeams(str(body.text)); break;
      case "addPlayers":   await repo.addPlayers(str(body.text)); break;
      case "deleteTeam":   await repo.deleteTeam(int(body.id, "팀 ID")); break;
      case "deletePlayer": await repo.deletePlayer(int(body.id, "선수 ID")); break;
      case "regenCode":    await repo.regenerateCode(int(body.id, "팀 ID")); break;
      case "settings":     await repo.updateSettings(int(body.rounds, "라운드"), int(body.pickSeconds, "제한 시간")); break;
      case "shuffleOrder": await repo.shuffleOrder(); break;
      case "moveTeam":     await repo.moveTeam(int(body.id, "팀 ID"), int(body.delta, "이동 방향") < 0 ? -1 : 1); break;
      case "start":        await repo.startDraft(); break;
      case "pause":        await repo.pauseDraft(); break;
      case "resume":       await repo.resumeDraft(); break;
      case "autopick":     await repo.forceAutoPick(); break;
      case "undo":         await repo.undoLastPick(); break;
      case "reset":        await repo.resetDraft(); break;
      case "wipe":         await repo.wipeAll(); break;
      case "seed":         await repo.seedSample(); break;
      default:
        throw new DraftError(400, "알 수 없는 작업입니다.");
    }
    return repo.getAdminState();
  });
}
