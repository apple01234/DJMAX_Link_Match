// 백업 파일로 DB를 되돌린다. 드래프트를 일시정지한 상태에서 실행하세요.
// 사용: npm run restore -- backups/linkmatch-20270129-030000.json
// 복원 전 현재 상태를 backups/before-restore-*.json 으로 먼저 저장한다.
// 하나의 트랜잭션이라 중간에 실패하면 아무것도 바뀌지 않는다.
import fs from "node:fs";
import path from "node:path";
import { connect, dump, stamp, summary } from "./pg-common.mjs";

const src = process.argv[2];
if (!src || !fs.existsSync(src)) {
  console.error("사용법: npm run restore -- <백업 파일>");
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(src, "utf8"));
const ok =
  data?.format === "linkmatch-backup/1" &&
  data.draft &&
  [data.teams, data.players, data.picks].every(Array.isArray);
if (!ok) {
  console.error("LINK MATCH 백업 파일이 아니거나 손상되었습니다. 복원을 중단합니다.");
  process.exit(1);
}

const client = connect();
await client.connect();

// 현재 상태를 먼저 보관
const DIR = process.env.BACKUP_DIR || path.join(process.cwd(), "backups");
fs.mkdirSync(DIR, { recursive: true });
const keep = path.join(DIR, `before-restore-${stamp()}.json`);
fs.writeFileSync(keep, JSON.stringify(await dump(client), null, 2));
console.log(`현재 DB 보관: ${keep}`);

const insert = async (table, rows, cols) => {
  for (const r of rows) {
    const vals = cols.map((c) => r[c]);
    await client.query(
      `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")})`,
      vals,
    );
  }
};

await client.query("BEGIN");
try {
  await client.query("SELECT 1 FROM draft WHERE id = 1 FOR UPDATE");
  await client.query("DELETE FROM picks");
  await client.query("DELETE FROM players");
  await client.query("DELETE FROM teams");
  await insert("teams", data.teams, ["id", "name", "captain", "captain_code", "color", "created_at"]);
  await insert("players", data.players, ["id", "nickname", "tier", "rating", "main_key", "note"]);
  await insert("picks", data.picks, ["pick_no", "team_id", "player_id", "auto", "picked_at"]);
  const d = data.draft;
  await client.query(
    `UPDATE draft SET status = $1, rounds = $2, pick_seconds = $3, order_json = $4,
       turn_started_at = $5, paused_left_ms = $6, version = version + 1 WHERE id = 1`,
    [d.status, d.rounds, d.pick_seconds, d.order_json, d.turn_started_at, d.paused_left_ms],
  );
  // 다음에 추가하는 팀·선수 id가 복원한 id와 겹치지 않게
  for (const t of ["teams", "players"]) {
    await client.query(
      `SELECT setval(pg_get_serial_sequence('${t}', 'id'), COALESCE((SELECT MAX(id) FROM ${t}), 0) + 1, false)`,
    );
  }
  await client.query("COMMIT");
} catch (e) {
  await client.query("ROLLBACK");
  console.error("복원 실패 — 아무것도 바뀌지 않았습니다:", e.message);
  process.exit(1);
}

console.log(`복원 완료 (${summary(await dump(client))})`);
await client.end();
