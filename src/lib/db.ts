import "server-only";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "data", "linkmatch.sqlite");

/**
 * 스키마. 무결성은 가능한 한 DB 제약으로 강제한다:
 *  - picks.pick_no PRIMARY KEY → 같은 차례에 두 번 지명 불가
 *  - picks.player_id UNIQUE   → 한 선수를 두 팀이 지명 불가
 *  - draft.id = 1 CHECK       → 드래프트 상태는 단일 행
 */
const SCHEMA = /* sql */ `
CREATE TABLE IF NOT EXISTS teams (
  id            INTEGER PRIMARY KEY,
  name          TEXT    NOT NULL UNIQUE,
  captain       TEXT    NOT NULL,
  captain_code  TEXT    NOT NULL UNIQUE,
  color         TEXT    NOT NULL,
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS players (
  id        INTEGER PRIMARY KEY,
  nickname  TEXT    NOT NULL UNIQUE,
  tier      TEXT    NOT NULL DEFAULT 'B' CHECK (tier IN ('S','A','B','C')),
  rating    INTEGER NOT NULL DEFAULT 0 CHECK (rating >= 0),
  main_key  TEXT    NOT NULL DEFAULT '4B' CHECK (main_key IN ('4B','5B','6B','8B')),
  note      TEXT    NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS picks (
  pick_no    INTEGER PRIMARY KEY,
  team_id    INTEGER NOT NULL REFERENCES teams(id)   ON DELETE CASCADE,
  player_id  INTEGER NOT NULL UNIQUE REFERENCES players(id) ON DELETE CASCADE,
  auto       INTEGER NOT NULL DEFAULT 0,
  picked_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS draft (
  id               INTEGER PRIMARY KEY CHECK (id = 1),
  status           TEXT    NOT NULL DEFAULT 'setup'
                   CHECK (status IN ('setup','running','paused','done')),
  rounds           INTEGER NOT NULL DEFAULT 3 CHECK (rounds BETWEEN 1 AND 10),
  pick_seconds     INTEGER NOT NULL DEFAULT 60 CHECK (pick_seconds BETWEEN 10 AND 600),
  order_json       TEXT    NOT NULL DEFAULT '[]',
  turn_started_at  INTEGER,
  paused_left_ms   INTEGER,
  version          INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO draft (id) VALUES (1);
`;

declare global {
  // dev 서버 HMR 시 커넥션이 중복 생성되지 않도록 전역에 보관
  var __linkmatchDb: DatabaseSync | undefined;
}

export function db(): DatabaseSync {
  if (!globalThis.__linkmatchDb) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    const conn = new DatabaseSync(DB_PATH);
    conn.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;");
    conn.exec(SCHEMA);
    globalThis.__linkmatchDb = conn;
  }
  return globalThis.__linkmatchDb;
}

/** BEGIN IMMEDIATE로 쓰기 잠금을 먼저 잡아 '읽고-검사하고-쓰기'를 원자적으로 만든다. */
export function tx<T>(fn: () => T): T {
  const conn = db();
  conn.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    conn.exec("COMMIT");
    return result;
  } catch (err) {
    conn.exec("ROLLBACK");
    throw err;
  }
}
