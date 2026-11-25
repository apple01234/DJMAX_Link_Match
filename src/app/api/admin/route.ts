import { isAdmin } from "@/lib/auth";
import { handle, int, readBody, str } from "@/lib/http";
import { clientKey, guardAuth } from "@/lib/ratelimit";
import * as repo from "@/lib/repo";
import { DraftError } from "@/lib/repo";

export const dynamic = "force-dynamic";

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
    switch (str(body.action)) {
      case "addTeams":     repo.addTeams(str(body.text)); break;
      case "addPlayers":   repo.addPlayers(str(body.text)); break;
      case "deleteTeam":   repo.deleteTeam(int(body.id, "팀 ID")); break;
      case "deletePlayer": repo.deletePlayer(int(body.id, "선수 ID")); break;
      case "regenCode":    repo.regenerateCode(int(body.id, "팀 ID")); break;
      case "settings":     repo.updateSettings(int(body.rounds, "라운드"), int(body.pickSeconds, "제한 시간")); break;
      case "shuffleOrder": repo.shuffleOrder(); break;
      case "moveTeam":     repo.moveTeam(int(body.id, "팀 ID"), int(body.delta, "이동 방향") < 0 ? -1 : 1); break;
      case "start":        repo.startDraft(); break;
      case "pause":        repo.pauseDraft(); break;
      case "resume":       repo.resumeDraft(); break;
      case "autopick":     repo.forceAutoPick(); break;
      case "undo":         repo.undoLastPick(); break;
      case "reset":        repo.resetDraft(); break;
      case "wipe":         repo.wipeAll(); break;
      case "seed":         repo.seedSample(); break;
      default:
        throw new DraftError(400, "알 수 없는 작업입니다.");
    }
    return repo.getAdminState();
  });
}
