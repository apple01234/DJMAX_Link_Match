/**
 * src/lib/repo.ts의 브라우저 메모리 버전. 데모 빌드에서 "@/lib/repo"를 이 파일로 바꿔 끼운다.
 * 규칙(스네이크 순서, 지연 평가 자동 지명, 상태 전이, 오류 메시지)은 원본과 같게 유지한다.
 * SQLite 대신 모듈 변수 하나에 상태를 두고, 새로고침하면 처음부터 다시 시작한다.
 */
import { pickAutoCandidate, shuffle, slotAt, startProblem, totalPicks, type DraftStatus, type Slot } from "@/lib/draft";
import {
  MAIN_KEYS,
  TIERS,
  type AdminState,
  type DraftInfo,
  type MainKey,
  type Pick,
  type Player,
  type PublicState,
  type Team,
  type TeamWithCode,
  type Tier,
} from "@/lib/types";

export class DraftError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const TEAM_COLORS = ["#4de1ff", "#ff4fa3", "#ffd166", "#7cff8a", "#b18cff", "#ff8c5a", "#5aa8ff", "#ff5a6e", "#3ef0c4", "#e8e6ff"];
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const db = {
  draft: { status: "setup", rounds: 3, pickSeconds: 60, order: [], turnStartedAt: null, pausedLeftMs: null, version: 0 } as DraftInfo,
  teams: [] as TeamWithCode[],
  players: [] as Player[],
  picks: [] as Pick[],
  seq: { team: 0, player: 0 },
};

/* ── 변경 알림 (데모 화면이 서버 렌더 페이지를 다시 그리는 데 쓴다) ── */
const listeners = new Set<() => void>();
export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export const version = () => db.draft.version;
let notifyQueued = false;
function bump() {
  db.draft.version++;
  // 서버 렌더 페이지가 렌더 중에 getPublicState()를 부르며 상태가 바뀔 수 있으므로, 알림은 렌더가 끝난 뒤에 보낸다
  if (notifyQueued) return;
  notifyQueued = true;
  queueMicrotask(() => {
    notifyQueued = false;
    listeners.forEach((fn) => fn());
  });
}

/** 원본의 트랜잭션 대신: 실패하면 상태를 통째로 되돌린다 */
function tx(fn: () => void) {
  const snap = structuredClone({ draft: db.draft, teams: db.teams, players: db.players, picks: db.picks, seq: db.seq });
  try {
    fn();
  } catch (e) {
    Object.assign(db, snap);
    throw e;
  }
}

const readPlayers = () => [...db.players].sort((a, b) => b.rating - a.rating || a.nickname.localeCompare(b.nickname));
const taken = (playerId: number) => db.picks.some((p) => p.playerId === playerId);

function effectiveOrder(stored: number[], teams: Team[]): number[] {
  const ids = new Set(teams.map((t) => t.id));
  const order = stored.filter((id) => ids.has(id));
  for (const t of teams) if (!order.includes(t.id)) order.push(t.id);
  return order;
}

function requireStatus(d: DraftInfo, ...allowed: DraftStatus[]) {
  if (!allowed.includes(d.status)) {
    const label: Record<DraftStatus, string> = { setup: "준비 중", running: "진행 중", paused: "일시정지", done: "완료" };
    throw new DraftError(409, `드래프트가 '${label[d.status]}' 상태라 할 수 없는 작업입니다.`);
  }
}

function newCode(): string {
  for (;;) {
    let code = "";
    for (let i = 0; i < 6; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    if (!db.teams.some((t) => t.captainCode === code)) return code;
  }
}

/* ───────────── draft engine ───────────── */

function recordPick(slot: Slot, playerId: number, auto: boolean, at: number) {
  const d = db.draft;
  db.picks.push({ pickNo: slot.pickNo, teamId: slot.teamId, playerId, auto, pickedAt: at });
  if (slot.pickNo + 1 >= totalPicks(d.order.length, d.rounds)) {
    Object.assign(d, { status: "done", turnStartedAt: null, pausedLeftMs: null });
  } else {
    d.turnStartedAt = at;
  }
  bump();
}

function autoPickCurrent(at: number): boolean {
  const d = db.draft;
  const slot = slotAt(d.order, d.rounds, db.picks.length);
  if (!slot) return false;
  const cand = pickAutoCandidate(readPlayers().filter((p) => !taken(p.id)));
  if (!cand) {
    Object.assign(d, { status: "done", turnStartedAt: null });
    bump();
    return false;
  }
  recordPick(slot, cand.id, true, at);
  return true;
}

function catchUp(now: number) {
  for (let guard = 0; guard < 1000; guard++) {
    const d = db.draft;
    if (d.status !== "running" || d.turnStartedAt == null) return;
    const deadline = d.turnStartedAt + d.pickSeconds * 1000;
    if (now < deadline) return;
    if (!autoPickCurrent(deadline)) return;
  }
}

/* ───────────── public API ───────────── */

function buildState(now: number): AdminState {
  const d = db.draft;
  const order = d.status === "setup" ? effectiveOrder(d.order, db.teams) : d.order;
  const active = d.status === "running" || d.status === "paused";
  return structuredClone({
    draft: { ...d, order },
    teams: [...db.teams].sort((a, b) => a.id - b.id),
    players: readPlayers(),
    picks: [...db.picks].sort((a, b) => a.pickNo - b.pickNo),
    current: active ? slotAt(order, d.rounds, db.picks.length) : null,
    deadline: d.status === "running" && d.turnStartedAt != null ? d.turnStartedAt + d.pickSeconds * 1000 : null,
    serverNow: now,
  });
}

export function getPublicState(now = Date.now()): PublicState {
  catchUp(now);
  const s = buildState(now);
  return { ...s, teams: s.teams.map(({ captainCode: _c, ...t }) => t) };
}

export function getAdminState(now = Date.now()): AdminState {
  catchUp(now);
  return buildState(now);
}

export function captainLogin(code: string): Team {
  const r = db.teams.find((t) => t.captainCode === code.trim().toUpperCase());
  if (!r) throw new DraftError(401, "주장 코드가 올바르지 않습니다.");
  return { id: r.id, name: r.name, captain: r.captain, color: r.color };
}

export function captainPick(code: string, playerId: number, now = Date.now(), expectedPickNo?: number): PublicState {
  const team = captainLogin(code);
  tx(() => {
    catchUp(now);
    const d = db.draft;
    if (d.status === "paused") throw new DraftError(409, "드래프트가 일시정지 상태입니다.");
    if (d.status !== "running") throw new DraftError(409, "드래프트가 진행 중이 아닙니다.");
    const slot = slotAt(d.order, d.rounds, db.picks.length);
    if (!slot) throw new DraftError(409, "남은 차례가 없습니다.");
    if (slot.teamId !== team.id) throw new DraftError(403, "지금은 이 팀의 차례가 아닙니다.");
    if (expectedPickNo !== undefined && expectedPickNo !== slot.pickNo) {
      throw new DraftError(409, "그 사이 차례가 넘어갔습니다. 화면을 확인하고 다시 지명하세요.");
    }
    if (!db.players.some((p) => p.id === playerId)) throw new DraftError(404, "존재하지 않는 선수입니다.");
    if (taken(playerId)) throw new DraftError(409, "이미 지명된 선수입니다.");
    recordPick(slot, playerId, false, now);
  });
  return getPublicState(now);
}

/* ───────────── admin actions ───────────── */

export const LIMITS = { teamName: 24, captain: 16, nickname: 20, note: 60 } as const;

function parseLines(text: string): string[][] {
  const rows = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => l.replace(/[\u0000-\u0008\u000B-\u001F\u007F​-‏‪-‮]/g, ""))
    .map((l) => l.split(/\s*[,\t]\s*/));
  if (rows.length > 200) throw new DraftError(400, "한 번에 최대 200줄까지 추가할 수 있습니다.");
  return rows;
}

function checkLen(value: string, max: number, line: string, label: string) {
  if ([...value].length > max) throw new DraftError(400, `${line}: ${label}은(는) ${max}자 이하여야 합니다.`);
}

export function addTeams(text: string) {
  const rows = parseLines(text);
  if (rows.length === 0) throw new DraftError(400, "추가할 팀이 없습니다.");
  tx(() => {
    requireStatus(db.draft, "setup");
    rows.forEach(([name, captain], i) => {
      if (!name || !captain) throw new DraftError(400, `${i + 1}번째 줄: "팀명, 주장" 형식이어야 합니다.`);
      checkLen(name, LIMITS.teamName, `${i + 1}번째 줄`, "팀명");
      checkLen(captain, LIMITS.captain, `${i + 1}번째 줄`, "주장 이름");
      const n = db.teams.length;
      db.teams.push({ id: ++db.seq.team, name, captain, captainCode: newCode(), color: TEAM_COLORS[n % TEAM_COLORS.length] });
    });
    bump();
  });
}

export function addPlayers(text: string) {
  const rows = parseLines(text);
  if (rows.length === 0) throw new DraftError(400, "추가할 선수가 없습니다.");
  tx(() => {
    requireStatus(db.draft, "setup", "running", "paused");
    rows.forEach(([nickname, tier = "B", rating = "0", key = "4B", ...rest], i) => {
      const line = `${i + 1}번째 줄`;
      const t = tier.toUpperCase() as Tier;
      const k = key.toUpperCase() as MainKey;
      const r = Number(rating);
      if (!nickname) throw new DraftError(400, `${line}: 닉네임이 비어 있습니다.`);
      checkLen(nickname, LIMITS.nickname, line, "닉네임");
      checkLen(rest.join(", "), LIMITS.note, line, "메모");
      if (!TIERS.includes(t)) throw new DraftError(400, `${line}: 티어는 ${TIERS.join("/")} 중 하나여야 합니다.`);
      if (!Number.isInteger(r) || r < 0 || r > 99999) throw new DraftError(400, `${line}: 레이팅은 0~99999 정수여야 합니다.`);
      if (!MAIN_KEYS.includes(k)) throw new DraftError(400, `${line}: 주력 키는 ${MAIN_KEYS.join("/")} 중 하나여야 합니다.`);
      db.players.push({ id: ++db.seq.player, nickname, tier: t, rating: r, mainKey: k, note: rest.join(", ") });
    });
    bump();
  });
}

export function deleteTeam(id: number) {
  tx(() => {
    requireStatus(db.draft, "setup");
    db.teams = db.teams.filter((t) => t.id !== id);
    bump();
  });
}

export function deletePlayer(id: number) {
  if (taken(id)) throw new DraftError(409, "이미 지명된 선수는 삭제할 수 없습니다. 먼저 픽을 되돌리세요.");
  db.players = db.players.filter((p) => p.id !== id);
  bump();
}

export function regenerateCode(teamId: number) {
  const t = db.teams.find((x) => x.id === teamId);
  if (t) t.captainCode = newCode();
  bump();
}

export function updateSettings(rounds: number, pickSeconds: number) {
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > 10) throw new DraftError(400, "라운드는 1~10 사이 정수여야 합니다.");
  if (!Number.isInteger(pickSeconds) || pickSeconds < 10 || pickSeconds > 600) {
    throw new DraftError(400, "픽 제한 시간은 10~600초 사이여야 합니다.");
  }
  requireStatus(db.draft, "setup");
  Object.assign(db.draft, { rounds, pickSeconds });
  bump();
}

export function shuffleOrder() {
  requireStatus(db.draft, "setup");
  db.draft.order = shuffle(effectiveOrder(db.draft.order, db.teams));
  bump();
}

export function moveTeam(teamId: number, delta: -1 | 1) {
  requireStatus(db.draft, "setup");
  const order = effectiveOrder(db.draft.order, db.teams);
  const i = order.indexOf(teamId);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= order.length) return;
  [order[i], order[j]] = [order[j], order[i]];
  db.draft.order = order;
  bump();
}

export function startDraft(now = Date.now()) {
  const d = db.draft;
  requireStatus(d, "setup");
  const problem = startProblem(db.teams.length, db.players.length, d.rounds);
  if (problem) throw new DraftError(409, problem);
  db.picks = [];
  Object.assign(d, { status: "running", order: effectiveOrder(d.order, db.teams), turnStartedAt: now, pausedLeftMs: null });
  bump();
}

export function pauseDraft(now = Date.now()) {
  catchUp(now);
  const d = db.draft;
  requireStatus(d, "running");
  const left = Math.max(0, (d.turnStartedAt ?? now) + d.pickSeconds * 1000 - now);
  Object.assign(d, { status: "paused", turnStartedAt: null, pausedLeftMs: left });
  bump();
}

export function resumeDraft(now = Date.now()) {
  const d = db.draft;
  requireStatus(d, "paused");
  const left = d.pausedLeftMs ?? d.pickSeconds * 1000;
  Object.assign(d, { status: "running", turnStartedAt: now - (d.pickSeconds * 1000 - left), pausedLeftMs: null });
  bump();
}

export function forceAutoPick(now = Date.now()) {
  catchUp(now);
  const d = db.draft;
  const wasPaused = d.status === "paused";
  requireStatus(d, "running", "paused");
  autoPickCurrent(now);
  if (wasPaused && db.draft.status === "paused") db.draft.pausedLeftMs = d.pickSeconds * 1000;
}

export function undoLastPick(now = Date.now()) {
  const d = db.draft;
  requireStatus(d, "running", "paused", "done");
  if (db.picks.length === 0) throw new DraftError(409, "되돌릴 픽이 없습니다.");
  db.picks.pop();
  if (d.status === "paused") d.pausedLeftMs = d.pickSeconds * 1000;
  else Object.assign(d, { status: "running", turnStartedAt: now, pausedLeftMs: null });
  bump();
}

export function resetDraft() {
  db.picks = [];
  Object.assign(db.draft, { status: "setup", turnStartedAt: null, pausedLeftMs: null });
  bump();
}

export function wipeAll() {
  db.picks = [];
  db.players = [];
  db.teams = [];
  Object.assign(db.draft, { status: "setup", order: [], turnStartedAt: null, pausedLeftMs: null });
  bump();
}

/** 원본과 같은 가상의 샘플 데이터 */
export function seedSample() {
  const teams = [
    "Neon Pulse, 하람", "Midnight Lane, 서진", "Afterglow, 도윤", "Bit Crusher, 유나",
    "Overdrive, 지호", "Glass Echo, 민서", "Starfall, 태오", "Low Fi, 은채",
  ];
  const nicks = [
    "Rin", "Kairo", "모카", "Sol", "lumen", "새벽", "Pixel", "Haze", "Vela", "토끼", "Orbit",
    "Echo", "Nimbus", "Lark", "Fizz", "Ember", "Quill", "민트", "Juno", "Tempo", "Drift",
    "Aria", "Coda", "Rune", "Sable", "Wisp", "Zephyr", "Noir", "Prism", "Halo", "Kite", "Static",
  ];
  let seed = 20270130;
  const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const players = nicks.map((nick) => {
    const rating = 5200 + Math.floor(rand() * 4600);
    const tier = rating >= 9000 ? "S" : rating >= 7800 ? "A" : rating >= 6400 ? "B" : "C";
    return `${nick}, ${tier}, ${rating}, ${MAIN_KEYS[Math.floor(rand() * MAIN_KEYS.length)]}`;
  });
  wipeAll();
  addTeams(teams.join("\n"));
  addPlayers(players.join("\n"));
}

/* ───────────── 데모 전용 ───────────── */

/** 사람이 아닌 주장(CPU)이 고르는 선수: 남은 상위 4명 중 하나. 위쪽일수록 확률이 높다. */
function cpuChoice(): Player | null {
  const top = readPlayers().filter((p) => !taken(p.id)).slice(0, 4);
  if (top.length === 0) return null;
  const w = [0.5, 0.25, 0.15, 0.1].slice(0, top.length);
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < top.length; i++) if ((r -= w[i]) <= 0) return top[i];
  return top[0];
}

/** 현재 차례가 humanTeamId가 아니면, 차례 시작 후 delayMs가 지났을 때 CPU 주장이 지명한다. */
export function cpuTick(humanTeamId: number, delayMs: number, now = Date.now()) {
  catchUp(now);
  const d = db.draft;
  if (d.status !== "running" || d.turnStartedAt == null) return;
  const slot = slotAt(d.order, d.rounds, db.picks.length);
  if (!slot || slot.teamId === humanTeamId || now - d.turnStartedAt < delayMs) return;
  const p = cpuChoice();
  if (p) recordPick(slot, p.id, false, now);
}

export function codeOf(teamId: number): string {
  return db.teams.find((t) => t.id === teamId)?.captainCode ?? "";
}
