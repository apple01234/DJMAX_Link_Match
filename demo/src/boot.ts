/**
 * 데모 시작 상태: 샘플 데이터 → 3라운드 · 30초 → 내 팀을 3번째 순서로 → 드래프트 시작.
 * 내 팀 주장 코드와 운영진 토큰을 저장소에 넣어 두어 로그인 없이 바로 볼 수 있게 한다.
 */
import * as repo from "./mock/repo";
import { DEMO_ADMIN_TOKEN } from "./mock/client";

export const HUMAN_TEAM_ID = 1;
export const HUMAN_TEAM_NAME = "Neon Pulse";
const ROUNDS = 3;
const PICK_SECONDS = 30;

export const humanCode = () => repo.codeOf(HUMAN_TEAM_ID);

export function boot() {
  repo.seedSample();
  repo.updateSettings(ROUNDS, PICK_SECONDS);
  repo.moveTeam(HUMAN_TEAM_ID, 1);
  repo.moveTeam(HUMAN_TEAM_ID, 1);
  repo.startDraft();

  try {
    localStorage.setItem("linkmatch27.captainCode", humanCode());
    sessionStorage.setItem("linkmatch27.adminToken", DEMO_ADMIN_TOKEN);
  } catch {}

  // CPU 주장: 차례마다 2~5초 사이에서 고민한 뒤 지명한다
  const delays = new Map<number, number>();
  setInterval(() => {
    const n = repo.getAdminState().picks.length;
    if (!delays.has(n)) delays.set(n, 2000 + Math.random() * 3000);
    repo.cpuTick(HUMAN_TEAM_ID, delays.get(n)!);
  }, 250);
}
