// 백업 파일로 DB를 되돌린다. 반드시 앱 서버를 멈춘 뒤 실행하세요.
// 사용: node scripts/restore.mjs backups/linkmatch-20270129-030000.sqlite
//       DB_PATH=/tmp/restore-test.sqlite node scripts/restore.mjs <파일>   (테스트 환경 복원 리허설)
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const src = process.argv[2];
const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "data", "linkmatch.sqlite");

if (!src || !fs.existsSync(src)) {
  console.error("사용법: node scripts/restore.mjs <백업 파일>");
  process.exit(1);
}

const check = new DatabaseSync(src, { readOnly: true });
const ok = check.prepare("PRAGMA integrity_check").get();
check.close();
if (ok.integrity_check !== "ok") {
  console.error("백업 파일이 손상되었습니다. 복원을 중단합니다.");
  process.exit(1);
}

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
// 현재 DB는 지우지 않고 옆에 보관
if (fs.existsSync(DB_PATH)) {
  const keep = `${DB_PATH}.before-restore-${Date.now()}`;
  fs.renameSync(DB_PATH, keep);
  console.log(`기존 DB 보관: ${keep}`);
}
for (const ext of ["-wal", "-shm"]) if (fs.existsSync(DB_PATH + ext)) fs.rmSync(DB_PATH + ext);
fs.copyFileSync(src, DB_PATH);

const db = new DatabaseSync(DB_PATH, { readOnly: true });
const c = db
  .prepare("SELECT (SELECT COUNT(*) FROM teams) t, (SELECT COUNT(*) FROM players) p, (SELECT COUNT(*) FROM picks) k, (SELECT status FROM draft) s")
  .get();
db.close();
console.log(`복원 완료: ${DB_PATH} (팀 ${c.t} · 선수 ${c.p} · 픽 ${c.k} · 드래프트 ${c.s})`);
