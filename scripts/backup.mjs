// SQLite 온라인 백업: 서버가 돌아가는 중에도 일관된 스냅숏을 만든다 (VACUUM INTO).
// 사용: node scripts/backup.mjs            → backups/linkmatch-YYYYMMDD-HHMMSS.sqlite
//       BACKUP_DIR=/path KEEP=14 node scripts/backup.mjs
// 하루 한 번 cron/작업 스케줄러에 등록하고, BACKUP_DIR은 앱 서버와 다른 디스크나 원격 저장소로 동기화하세요.
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "data", "linkmatch.sqlite");
const DIR = process.env.BACKUP_DIR || path.join(process.cwd(), "backups");
const KEEP = Math.max(1, Number(process.env.KEEP ?? 14));

if (!fs.existsSync(DB_PATH)) {
  console.error(`DB 파일이 없습니다: ${DB_PATH}`);
  process.exit(1);
}
fs.mkdirSync(DIR, { recursive: true });

const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
const out = path.join(DIR, `linkmatch-${stamp}.sqlite`);

const db = new DatabaseSync(DB_PATH, { readOnly: true });
// 경로는 스크립트가 만든 값이지만 SQL 문자열 리터럴이므로 작은따옴표를 이스케이프한다
db.exec(`VACUUM INTO '${out.replaceAll("'", "''")}'`);
db.close();

// 무결성 확인
const check = new DatabaseSync(out, { readOnly: true });
const ok = check.prepare("PRAGMA integrity_check").get();
const counts = check
  .prepare("SELECT (SELECT COUNT(*) FROM teams) t, (SELECT COUNT(*) FROM players) p, (SELECT COUNT(*) FROM picks) k")
  .get();
check.close();
if (ok.integrity_check !== "ok") {
  console.error("백업 파일 무결성 검사 실패:", ok);
  process.exit(1);
}

// 오래된 백업 정리
const files = fs
  .readdirSync(DIR)
  .filter((f) => /^linkmatch-\d{8}-\d{6}\.sqlite$/.test(f))
  .sort();
for (const f of files.slice(0, Math.max(0, files.length - KEEP))) fs.rmSync(path.join(DIR, f));

console.log(`백업 완료: ${out} (팀 ${counts.t} · 선수 ${counts.p} · 픽 ${counts.k}) · 보관 ${Math.min(files.length, KEEP)}개`);
