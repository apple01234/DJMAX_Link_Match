/**
 * "@/lib/client" 대체. cn·formatClock·STATUS_LABEL은 원본을 그대로 쓰고,
 * api()만 네트워크 대신 메모리 서버(mock/repo)로 보낸다. 분기는 src/app/api/*의 라우트와 같다.
 */
import * as repo from "./repo";

export { cn, formatClock, STATUS_LABEL } from "../../../src/lib/client";

export const DEMO_ADMIN_TOKEN = "demo";

type Body = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");
function int(v: unknown, label: string): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isInteger(n)) throw new repo.DraftError(400, `${label}이(가) 올바르지 않습니다.`);
  return n;
}

function route(method: string, path: string, headers: Record<string, string>, body: Body): unknown {
  if (path === "/api/state" && method === "GET") return repo.getPublicState();
  if (path === "/api/captain/login" && method === "POST") return { team: repo.captainLogin(str(body.code)) };
  if (path === "/api/draft/pick" && method === "POST") {
    return repo.captainPick(str(body.code), int(body.playerId, "선수 ID"));
  }
  if (path === "/api/admin") {
    if (headers["x-admin-token"] !== DEMO_ADMIN_TOKEN) throw new repo.DraftError(401, "관리자 토큰이 올바르지 않습니다.");
    if (method === "GET") return repo.getAdminState();
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
        throw new repo.DraftError(400, "알 수 없는 작업입니다.");
    }
    return repo.getAdminState();
  }
  throw new repo.DraftError(404, "없는 경로입니다.");
}

/** 원본 api()와 같은 모양: 실패하면 서버 메시지를 Error로 던진다. 네트워크처럼 보이게 짧게 지연. */
export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, method } = init;
  await new Promise((r) => setTimeout(r, 60));
  try {
    return route(
      method ?? (json !== undefined ? "POST" : "GET"),
      path,
      (headers ?? {}) as Record<string, string>,
      (json ?? {}) as Body,
    ) as T;
  } catch (e) {
    if (e instanceof repo.DraftError) throw new Error(e.message);
    throw e;
  }
}
