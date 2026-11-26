import type { DraftStatus, Slot } from "./draft";

/** V-ARCHIVE 티어 그룹(높은 순). 기준 점수는 https://v-archive.net/db/tiers.json 에서 그룹별 최저 점수 */
export const TIERS = ["GM", "M", "DM", "PT", "GD", "SV", "BR", "IR", "AM", "BG"] as const;
export type Tier = (typeof TIERS)[number];

export const TIER_INFO: Record<Tier, { name: string; min: number }> = {
  GM: { name: "그랜드마스터", min: 9950 },
  M: { name: "마스터", min: 9700 },
  DM: { name: "다이아", min: 9000 },
  PT: { name: "플래티넘", min: 8200 },
  GD: { name: "골드", min: 7400 },
  SV: { name: "실버", min: 6600 },
  BR: { name: "브론즈", min: 5300 },
  IR: { name: "아이언", min: 4000 },
  AM: { name: "아마추어", min: 500 },
  BG: { name: "비기너", min: 0 },
};

/** 레이팅(V-ARCHIVE 티어 점수)에 맞는 티어 */
export function tierFromRating(rating: number): Tier {
  return TIERS.find((t) => rating >= TIER_INFO[t].min) ?? "BG";
}

const TIER_ALIASES: Record<string, Tier> = {
  gm: "GM", grandmaster: "GM", 그마: "GM", 그랜드마스터: "GM",
  m: "M", master: "M", 마스터: "M",
  dm: "DM", diamond: "DM", 다이아: "DM", 다이야: "DM", 다야: "DM",
  pt: "PT", platinum: "PT", 플래티넘: "PT", 플레티넘: "PT", 플래: "PT", 플레: "PT",
  gd: "GD", gold: "GD", 골드: "GD",
  sv: "SV", silver: "SV", 실버: "SV",
  br: "BR", bronze: "BR", 브론즈: "BR",
  ir: "IR", iron: "IR", 아이언: "IR",
  am: "AM", amateur: "AM", 아마추어: "AM", 아마: "AM",
  bg: "BG", beginner: "BG", 비기너: "BG",
};

/** 일괄 입력의 티어 칸: 코드(DM), 한글(다이아·다이야·그마), 영어(Diamond II) 모두 받는다. 모르면 null */
export function parseTier(input: string): Tier | null {
  const s = input.toLowerCase().replace(/\s+/g, "");
  return TIER_ALIASES[s] ?? TIER_ALIASES[s.replace(/(iv|v|i{1,3}|[1-4])$/, "")] ?? null;
}

export const MAIN_KEYS = ["4B", "5B", "6B", "8B"] as const;
export type MainKey = (typeof MAIN_KEYS)[number];

export interface Team {
  id: number;
  name: string;
  captain: string;
  color: string;
}

/** 관리자에게만 노출되는 주장 코드 포함 */
export interface TeamWithCode extends Team {
  captainCode: string;
}

export interface Player {
  id: number;
  nickname: string;
  tier: Tier;
  rating: number;
  mainKey: MainKey;
  note: string;
}

export interface Pick {
  pickNo: number;
  teamId: number;
  playerId: number;
  auto: boolean;
  pickedAt: number;
}

export interface DraftInfo {
  status: DraftStatus;
  rounds: number;
  pickSeconds: number;
  /** 1라운드 기준 팀 순서 (스네이크는 여기서 파생) */
  order: number[];
  turnStartedAt: number | null;
  pausedLeftMs: number | null;
  version: number;
}

export interface PublicState {
  draft: DraftInfo;
  teams: Team[];
  players: Player[];
  picks: Pick[];
  current: Slot | null;
  /** 현재 픽 마감 시각 (epoch ms). 진행 중이 아니면 null */
  deadline: number | null;
  serverNow: number;
}

export interface AdminState extends Omit<PublicState, "teams"> {
  teams: TeamWithCode[];
}
