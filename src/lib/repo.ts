import "server-only";
import { randomInt } from "node:crypto";
import { db, tx } from "./db";
import {
  pickAutoCandidate,
  shuffle,
  slotAt,
  startProblem,
  totalPicks,
  type DraftStatus,
  type Slot,
} from "./draft";
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
} from "./types";

export class DraftError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const TEAM_COLORS = [
  "#4de1ff", "#ff4fa3", "#ffd166", "#7cff8a", "#b18cff",
  "#ff8c5a", "#5aa8ff", "#ff5a6e", "#3ef0c4", "#e8e6ff",
];
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 0/O, 1/I 제외

/* ───────────────────────── rows ───────────────────────── */

interface TeamRow { id: number; name: string; captain: string; captain_code: string; color: string }
interface PlayerRow { id: number; nickname: string; tier: Tier; rating: number; main_key: MainKey; note: string }
interface PickRow { pick_no: number; team_id: number; player_id: number; auto: number; picked_at: number }
interface DraftRow {
  status: DraftStatus; rounds: number; pick_seconds: number; order_json: string;
  turn_started_at: number | null; paused_left_ms: number | null; version: number;
}

const all = <T>(sql: string, ...params: (string | number | null)[]) =>
  db().prepare(sql).all(...params) as unknown as T[];
const get = <T>(sql: string, ...params: (string | number | null)[]) =>
  db().prepare(sql).get(...params) as unknown as T | undefined;
const run = (sql: string, ...params: (string | number | null)[]) => db().prepare(sql).run(...params);

function readDraft(): DraftInfo {
  const r = get<DraftRow>("SELECT * FROM draft WHERE id = 1")!;
  return {
    status: r.status,
    rounds: r.rounds,
    pickSeconds: r.pick_seconds,
    order: JSON.parse(r.order_json) as number[],
    turnStartedAt: r.turn_started_at,
    pausedLeftMs: r.paused_left_ms,
    version: r.version,
  };
}

function readTeams(): TeamWithCode[] {
  return all<TeamRow>("SELECT * FROM teams ORDER BY id").map((r) => ({
    id: r.id, name: r.name, captain: r.captain, color: r.color, captainCode: r.captain_code,
  }));
}

function readPlayers(): Player[] {
  return all<PlayerRow>("SELECT * FROM players ORDER BY rating DESC, nickname").map((r) => ({
    id: r.id, nickname: r.nickname, tier: r.tier, rating: r.rating, mainKey: r.main_key, note: r.note,
  }));
}

function readPicks(): Pick[] {
  return all<PickRow>("SELECT * FROM picks ORDER BY pick_no").map((r) => ({
    pickNo: r.pick_no, teamId: r.team_id, playerId: r.player_id, auto: r.auto === 1, pickedAt: r.picked_at,
  }));
}

const pickCount = () => get<{ n: number }>("SELECT COUNT(*) AS n FROM picks")!.n;
const bump = () => run("UPDATE draft SET version = version + 1 WHERE id = 1");

/** setup 단계에서는 팀 추가/삭제가 자유로우므로 저장된 순서와 실제 팀 목록을 맞춘다. */
function effectiveOrder(stored: number[], teams: Team[]): number[] {
  const ids = new Set(teams.map((t) => t.id));
  const order = stored.filter((id) => ids.has(id));
  for (const t of teams) if (!order.includes(t.id)) order.push(t.id);
  return order;
}

function requireStatus(d: DraftInfo, ...allowed: DraftStatus[]) {
  if (!allowed.includes(d.status)) {
    const label: Record<DraftStatus, string> = {
      setup: "준비 중", running: "진행 중", paused: "일시정지", done: "완료",
    };
    throw new DraftError(409, `드래프트가 '${label[d.status]}' 상태라 할 수 없는 작업입니다.`);
  }
}

function newCode(): string {
  for (;;) {
    let code = "";
    for (let i = 0; i < 6; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
    if (!get("SELECT 1 FROM teams WHERE captain_code = ?", code)) return code;
  }
}

/* ───────────────────────── draft engine ───────────────────────── */

/** 트랜잭션 안에서 호출. 픽을 기록하고 다음 차례(또는 종료)로 넘긴다. */
function recordPick(d: DraftInfo, slot: Slot, playerId: number, auto: boolean, at: number) {
  run(
    "INSERT INTO picks (pick_no, team_id, player_id, auto, picked_at) VALUES (?, ?, ?, ?, ?)",
    slot.pickNo, slot.teamId, playerId, auto ? 1 : 0, at,
  );
  if (slot.pickNo + 1 >= totalPicks(d.order.length, d.rounds)) {
    run("UPDATE draft SET status = 'done', turn_started_at = NULL, paused_left_ms = NULL WHERE id = 1");
  } else {
    run("UPDATE draft SET turn_started_at = ? WHERE id = 1", at);
  }
  bump();
}

function autoPickCurrent(at: number): boolean {
  const d = readDraft();
  const slot = slotAt(d.order, d.rounds, pickCount());
  if (!slot) return false;
  const available = readPlayers().filter(
    (p) => !get("SELECT 1 FROM picks WHERE player_id = ?", p.id),
  );
  const cand = pickAutoCandidate(available);
  if (!cand) {
    run("UPDATE draft SET status = 'done', turn_started_at = NULL WHERE id = 1");
    bump();
    return false;
  }
  recordPick(d, slot, cand.id, true, at);
  return true;
}

/**
 * 마감이 지난 차례를 자동 지명으로 처리한다.
 * 크론/백그라운드 워커 없이 읽기·쓰기 요청 시점에 지연 평가(lazy)하므로
 * 서버리스 환경에서도 그대로 동작한다. 서버가 오래 비어 있었다면 밀린 차례를
 * 각 마감 시각 기준으로 순서대로 처리한다.
 */
function catchUpInTx(now: number) {
  for (let guard = 0; guard < 1000; guard++) {
    const d = readDraft();
    if (d.status !== "running" || d.turnStartedAt == null) return;
    const deadline = d.turnStartedAt + d.pickSeconds * 1000;
    if (now < deadline) return;
    if (!autoPickCurrent(deadline)) return;
  }
}

function catchUp(now: number) {
  const d = readDraft();
  if (d.status !== "running" || d.turnStartedAt == null) return;
  if (now < d.turnStartedAt + d.pickSeconds * 1000) return; // 대부분의 요청은 쓰기 잠금 없이 끝남
  tx(() => catchUpInTx(now));
}

/* ───────────────────────── public API ───────────────────────── */

function buildState(now: number): AdminState {
  const d = readDraft();
  const teams = readTeams();
  const order = d.status === "setup" ? effectiveOrder(d.order, teams) : d.order;
  const picks = readPicks();
  const active = d.status === "running" || d.status === "paused";
  return {
    draft: { ...d, order },
    teams,
    players: readPlayers(),
    picks,
    current: active ? slotAt(order, d.rounds, picks.length) : null,
    deadline:
      d.status === "running" && d.turnStartedAt != null ? d.turnStartedAt + d.pickSeconds * 1000 : null,
    serverNow: now,
  };
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
  const r = get<TeamRow>("SELECT * FROM teams WHERE captain_code = ?", code.trim().toUpperCase());
  if (!r) throw new DraftError(401, "주장 코드가 올바르지 않습니다.");
  return { id: r.id, name: r.name, captain: r.captain, color: r.color };
}

export function captainPick(code: string, playerId: number, now = Date.now()): PublicState {
  const team = captainLogin(code);
  tx(() => {
    catchUpInTx(now);
    const d = readDraft();
    if (d.status === "paused") throw new DraftError(409, "드래프트가 일시정지 상태입니다.");
    if (d.status !== "running") throw new DraftError(409, "드래프트가 진행 중이 아닙니다.");
    const slot = slotAt(d.order, d.rounds, pickCount());
    if (!slot) throw new DraftError(409, "남은 차례가 없습니다.");
    if (slot.teamId !== team.id) throw new DraftError(403, "지금은 이 팀의 차례가 아닙니다.");
    if (!get("SELECT 1 FROM players WHERE id = ?", playerId)) {
      throw new DraftError(404, "존재하지 않는 선수입니다.");
    }
    if (get("SELECT 1 FROM picks WHERE player_id = ?", playerId)) {
      throw new DraftError(409, "이미 지명된 선수입니다.");
    }
    recordPick(d, slot, playerId, false, now);
  });
  return getPublicState(now);
}

/* ───────────────────────── admin actions ───────────────────────── */

const MAX_LINES = 200;
export const LIMITS = { teamName: 24, captain: 16, nickname: 20, note: 60 } as const;

function parseLines(text: string): string[][] {
  const rows = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    // 제어 문자 제거 (표시 깨짐·로그 오염 방지). 출력은 React가 이스케이프한다.
    .map((l) => l.replace(/[\u0000-\u0008\u000B-\u001F\u007F​-‏‪-‮]/g, ""))
    .map((l) => l.split(/\s*[,\t]\s*/));
  if (rows.length > MAX_LINES) throw new DraftError(400, `한 번에 최대 ${MAX_LINES}줄까지 추가할 수 있습니다.`);
  return rows;
}

function checkLen(value: string, max: number, line: string, label: string) {
  if ([...value].length > max) throw new DraftError(400, `${line}: ${label}은(는) ${max}자 이하여야 합니다.`);
}

export function addTeams(text: string) {
  const rows = parseLines(text);
  if (rows.length === 0) throw new DraftError(400, "추가할 팀이 없습니다.");
  tx(() => {
    requireStatus(readDraft(), "setup");
    let n = get<{ n: number }>("SELECT COUNT(*) AS n FROM teams")!.n;
    rows.forEach(([name, captain], i) => {
      if (!name || !captain) {
        throw new DraftError(400, `${i + 1}번째 줄: "팀명, 주장" 형식이어야 합니다.`);
      }
      checkLen(name, LIMITS.teamName, `${i + 1}번째 줄`, "팀명");
      checkLen(captain, LIMITS.captain, `${i + 1}번째 줄`, "주장 이름");
      run(
        "INSERT INTO teams (name, captain, captain_code, color, created_at) VALUES (?, ?, ?, ?, ?)",
        name, captain, newCode(), TEAM_COLORS[n++ % TEAM_COLORS.length], Date.now(),
      );
    });
    bump();
  });
}

export function addPlayers(text: string) {
  const rows = parseLines(text);
  if (rows.length === 0) throw new DraftError(400, "추가할 선수가 없습니다.");
  tx(() => {
    requireStatus(readDraft(), "setup", "running", "paused");
    rows.forEach(([nickname, tier = "B", rating = "0", key = "4B", ...rest], i) => {
      const line = `${i + 1}번째 줄`;
      const t = tier.toUpperCase() as Tier;
      const k = key.toUpperCase() as MainKey;
      const r = Number(rating);
      if (!nickname) throw new DraftError(400, `${line}: 닉네임이 비어 있습니다.`);
      checkLen(nickname, LIMITS.nickname, line, "닉네임");
      checkLen(rest.join(", "), LIMITS.note, line, "메모");
      if (!TIERS.includes(t)) throw new DraftError(400, `${line}: 티어는 ${TIERS.join("/")} 중 하나여야 합니다.`);
      if (!Number.isInteger(r) || r < 0 || r > 99999) {
        throw new DraftError(400, `${line}: 레이팅은 0~99999 정수여야 합니다.`);
      }
      if (!MAIN_KEYS.includes(k)) {
        throw new DraftError(400, `${line}: 주력 키는 ${MAIN_KEYS.join("/")} 중 하나여야 합니다.`);
      }
      run(
        "INSERT INTO players (nickname, tier, rating, main_key, note) VALUES (?, ?, ?, ?, ?)",
        nickname, t, r, k, rest.join(", "),
      );
    });
    bump();
  });
}

export function deleteTeam(id: number) {
  tx(() => {
    requireStatus(readDraft(), "setup");
    run("DELETE FROM teams WHERE id = ?", id);
    bump();
  });
}

export function deletePlayer(id: number) {
  tx(() => {
    if (get("SELECT 1 FROM picks WHERE player_id = ?", id)) {
      throw new DraftError(409, "이미 지명된 선수는 삭제할 수 없습니다. 먼저 픽을 되돌리세요.");
    }
    run("DELETE FROM players WHERE id = ?", id);
    bump();
  });
}

export function regenerateCode(teamId: number) {
  tx(() => {
    run("UPDATE teams SET captain_code = ? WHERE id = ?", newCode(), teamId);
    bump();
  });
}

export function updateSettings(rounds: number, pickSeconds: number) {
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > 10) {
    throw new DraftError(400, "라운드는 1~10 사이 정수여야 합니다.");
  }
  if (!Number.isInteger(pickSeconds) || pickSeconds < 10 || pickSeconds > 600) {
    throw new DraftError(400, "픽 제한 시간은 10~600초 사이여야 합니다.");
  }
  tx(() => {
    requireStatus(readDraft(), "setup");
    run("UPDATE draft SET rounds = ?, pick_seconds = ? WHERE id = 1", rounds, pickSeconds);
    bump();
  });
}

function writeOrder(order: number[]) {
  run("UPDATE draft SET order_json = ? WHERE id = 1", JSON.stringify(order));
  bump();
}

export function shuffleOrder() {
  tx(() => {
    const d = readDraft();
    requireStatus(d, "setup");
    writeOrder(shuffle(effectiveOrder(d.order, readTeams())));
  });
}

export function moveTeam(teamId: number, delta: -1 | 1) {
  tx(() => {
    const d = readDraft();
    requireStatus(d, "setup");
    const order = effectiveOrder(d.order, readTeams());
    const i = order.indexOf(teamId);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    writeOrder(order);
  });
}

export function startDraft(now = Date.now()) {
  tx(() => {
    const d = readDraft();
    requireStatus(d, "setup");
    const teams = readTeams();
    const players = get<{ n: number }>("SELECT COUNT(*) AS n FROM players")!.n;
    const problem = startProblem(teams.length, players, d.rounds);
    if (problem) throw new DraftError(409, problem);
    run("DELETE FROM picks");
    run(
      "UPDATE draft SET status = 'running', order_json = ?, turn_started_at = ?, paused_left_ms = NULL WHERE id = 1",
      JSON.stringify(effectiveOrder(d.order, teams)), now,
    );
    bump();
  });
}

export function pauseDraft(now = Date.now()) {
  tx(() => {
    catchUpInTx(now);
    const d = readDraft();
    requireStatus(d, "running");
    const left = Math.max(0, (d.turnStartedAt ?? now) + d.pickSeconds * 1000 - now);
    run("UPDATE draft SET status = 'paused', turn_started_at = NULL, paused_left_ms = ? WHERE id = 1", left);
    bump();
  });
}

export function resumeDraft(now = Date.now()) {
  tx(() => {
    const d = readDraft();
    requireStatus(d, "paused");
    const left = d.pausedLeftMs ?? d.pickSeconds * 1000;
    // 남은 시간이 그대로 유지되도록 시작 시각을 역산
    const startedAt = now - (d.pickSeconds * 1000 - left);
    run("UPDATE draft SET status = 'running', turn_started_at = ?, paused_left_ms = NULL WHERE id = 1", startedAt);
    bump();
  });
}

export function forceAutoPick(now = Date.now()) {
  tx(() => {
    catchUpInTx(now);
    const d = readDraft();
    requireStatus(d, "running", "paused");
    autoPickCurrent(now);
    if (d.status === "paused" && readDraft().status === "paused") {
      run("UPDATE draft SET paused_left_ms = pick_seconds * 1000 WHERE id = 1");
    }
  });
}

export function undoLastPick(now = Date.now()) {
  tx(() => {
    const d = readDraft();
    requireStatus(d, "running", "paused", "done");
    const last = get<{ pick_no: number }>("SELECT pick_no FROM picks ORDER BY pick_no DESC LIMIT 1");
    if (!last) throw new DraftError(409, "되돌릴 픽이 없습니다.");
    run("DELETE FROM picks WHERE pick_no = ?", last.pick_no);
    if (d.status === "paused") {
      run("UPDATE draft SET paused_left_ms = pick_seconds * 1000 WHERE id = 1");
    } else {
      run("UPDATE draft SET status = 'running', turn_started_at = ?, paused_left_ms = NULL WHERE id = 1", now);
    }
    bump();
  });
}

export function resetDraft() {
  tx(() => {
    run("DELETE FROM picks");
    run("UPDATE draft SET status = 'setup', turn_started_at = NULL, paused_left_ms = NULL WHERE id = 1");
    bump();
  });
}

export function wipeAll() {
  tx(() => {
    run("DELETE FROM picks");
    run("DELETE FROM players");
    run("DELETE FROM teams");
    run(
      "UPDATE draft SET status = 'setup', order_json = '[]', turn_started_at = NULL, paused_left_ms = NULL WHERE id = 1",
    );
    bump();
  });
}

/** 데모용 샘플 데이터. 모든 이름은 가상의 것이다. */
export function seedSample() {
  // 운영 데이터를 통째로 지우는 작업이므로 프로덕션에서는 명시적으로 허용했을 때만
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_SAMPLE_SEED !== "1") {
    throw new DraftError(403, "운영 환경에서는 샘플 데이터를 넣을 수 없습니다. (ALLOW_SAMPLE_SEED=1로 허용)");
  }
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
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const keys = MAIN_KEYS;
  const players = nicks.map((nick) => {
    const rating = 5200 + Math.floor(rand() * 4600);
    const tier = rating >= 9000 ? "S" : rating >= 7800 ? "A" : rating >= 6400 ? "B" : "C";
    return `${nick}, ${tier}, ${rating}, ${keys[Math.floor(rand() * keys.length)]}`;
  });
  wipeAll();
  addTeams(teams.join("\n"));
  addPlayers(players.join("\n"));
}
