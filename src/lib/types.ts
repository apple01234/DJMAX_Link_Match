import type { DraftStatus, Slot } from "./draft";

/**
 * DJMAX RESPECT V 래더 매치 티어(높은 순). 아이언~다이아몬드의 I~IV 등급은 구분하지 않는다.
 * 래더 티어는 V-ARCHIVE 점수와 기준이 달라 점수로 계산하지 않고, 운영진이 선수별로 입력한다.
 */
export const TIERS = ["GM", "M", "DM", "PT", "GD", "SV", "BR", "IR"] as const;
export type Tier = (typeof TIERS)[number];

export const TIER_INFO: Record<Tier, { name: string }> = {
  GM: { name: "그랜드 마스터" },
  M: { name: "마스터" },
  DM: { name: "다이아몬드" },
  PT: { name: "플래티넘" },
  GD: { name: "골드" },
  SV: { name: "실버" },
  BR: { name: "브론즈" },
  IR: { name: "아이언" },
};

const TIER_ALIASES: Record<string, Tier> = {
  gm: "GM", grandmaster: "GM", 그마: "GM", 그랜드마스터: "GM",
  m: "M", master: "M", 마스터: "M",
  dm: "DM", diamond: "DM", 다이아몬드: "DM", 다이아: "DM", 다이야: "DM", 다야: "DM",
  pt: "PT", platinum: "PT", 플래티넘: "PT", 플레티넘: "PT", 플래: "PT", 플레: "PT",
  gd: "GD", gold: "GD", 골드: "GD",
  sv: "SV", silver: "SV", 실버: "SV",
  br: "BR", bronze: "BR", 브론즈: "BR",
  ir: "IR", iron: "IR", 아이언: "IR",
};

/** 일괄 입력의 티어 칸: 코드(DM), 한글(다이아·다이야·그마), 영어·등급 포함(Diamond II, 골드 3) 모두 받는다. 모르면 null */
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
