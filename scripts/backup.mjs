// DB 백업: 팀·선수·픽·드래프트 상태를 JSON 파일 하나로 저장한다 (서버 실행 중에도 일관된 스냅숏).
// 사용: npm run backup                       → backups/linkmatch-YYYYMMDD-HHMMSS.json
//       BACKUP_DIR=/path KEEP=14 npm run backup
// 운영(Vercel + Neon) DB는 `vercel env pull .env.local`로 DATABASE_URL을 받은 뒤
//   node --env-file=.env.local scripts/backup.mjs
import fs from "node:fs";
import path from "node:path";
import { connect, dump, stamp, summary } from "./pg-common.mjs";

const DIR = process.env.BACKUP_DIR || path.join(process.cwd(), "backups");
const KEEP = Math.max(1, Number(process.env.KEEP ?? 14));

const client = connect();
await client.connect();
const data = await dump(client);
await client.end();

if (!data.draft) {
  console.error("드래프트 행이 없습니다. 앱을 한 번 실행해 스키마를 만든 뒤 다시 시도하세요.");
  process.exit(1);
}

fs.mkdirSync(DIR, { recursive: true });
const out = path.join(DIR, `linkmatch-${stamp()}.json`);
fs.writeFileSync(out, JSON.stringify(data, null, 2));

// 오래된 백업 정리
const files = fs
  .readdirSync(DIR)
  .filter((f) => /^linkmatch-\d{8}-\d{6}\.json$/.test(f))
  .sort();
for (const f of files.slice(0, Math.max(0, files.length - KEEP))) fs.rmSync(path.join(DIR, f));

console.log(`백업 완료: ${out} (${summary(data)}) · 보관 ${Math.min(files.length, KEEP)}개`);
