/**
 * 순수 드래프트 로직 — DB·프레임워크 의존성 없음.
 * 서버(API)와 클라이언트(드래프트 보드) 양쪽에서 같은 규칙을 사용한다.
 */

export type DraftStatus = "setup" | "running" | "paused" | "done";

export interface Slot {
  /** 0부터 시작하는 전체 픽 번호 */
  pickNo: number;
  /** 0부터 시작하는 라운드 */
  round: number;
  /** 라운드 안에서 몇 번째 픽인지 (0부터) */
  indexInRound: number;
  teamId: number;
}

export function totalPicks(teamCount: number, rounds: number): number {
  return Math.max(0, teamCount) * Math.max(0, rounds);
}

/**
 * 스네이크 드래프트 순서: 짝수 라운드는 정방향, 홀수 라운드는 역방향.
 * [A,B,C] × 3R → A B C | C B A | A B C
 */
export function snakeOrder(baseOrder: readonly number[], rounds: number): number[] {
  const out: number[] = [];
  for (let r = 0; r < rounds; r++) {
    out.push(...(r % 2 === 0 ? baseOrder : [...baseOrder].reverse()));
  }
  return out;
}

/** 전체 순서 배열을 만들지 않고 특정 픽 번호의 슬롯을 계산한다. */
export function slotAt(baseOrder: readonly number[], rounds: number, pickNo: number): Slot | null {
  const n = baseOrder.length;
  if (n === 0 || !Number.isInteger(pickNo) || pickNo < 0 || pickNo >= totalPicks(n, rounds)) {
    return null;
  }
  const round = Math.floor(pickNo / n);
  const indexInRound = pickNo % n;
  const teamId = round % 2 === 0 ? baseOrder[indexInRound] : baseOrder[n - 1 - indexInRound];
  return { pickNo, round, indexInRound, teamId };
}

/** 현재 팀이 다음에 픽하기까지 남은 픽 수 (0 = 지금 차례, null = 남은 차례 없음) */
export function picksUntilTurn(
  baseOrder: readonly number[],
  rounds: number,
  currentPickNo: number,
  teamId: number,
): number | null {
  const total = totalPicks(baseOrder.length, rounds);
  for (let p = currentPickNo; p < total; p++) {
    if (slotAt(baseOrder, rounds, p)?.teamId === teamId) return p - currentPickNo;
  }
  return null;
}

/** 시간 초과 시 자동 지명 대상: 레이팅이 가장 높은 선수, 동점이면 닉네임 오름차순. */
export function pickAutoCandidate<P extends { id: number; rating: number; nickname: string }>(
  available: readonly P[],
): P | null {
  let best: P | null = null;
  for (const p of available) {
    if (
      !best ||
      p.rating > best.rating ||
      (p.rating === best.rating && p.nickname.localeCompare(best.nickname) < 0)
    ) {
      best = p;
    }
  }
  return best;
}

/** Fisher–Yates. rand를 주입할 수 있어 테스트에서 결정적으로 동작한다. */
export function shuffle<T>(items: readonly T[], rand: () => number = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 팀이 2개 이상이고, 선수가 (팀 수 × 라운드) 이상이어야 시작할 수 있다. */
export function startProblem(teamCount: number, playerCount: number, rounds: number): string | null {
  if (teamCount < 2) return "팀이 2개 이상 필요합니다.";
  if (rounds < 1) return "라운드는 1 이상이어야 합니다.";
  const need = totalPicks(teamCount, rounds);
  if (playerCount < need) return `선수가 부족합니다. (${playerCount}/${need}명)`;
  return null;
}
