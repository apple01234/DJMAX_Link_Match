import type { DraftStatus, Slot } from "./draft";

export const TIERS = ["S", "A", "B", "C"] as const;
export type Tier = (typeof TIERS)[number];

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
