// 백업·복원 공용: Postgres 접속과 4개 테이블 덤프.
import pg from "pg";

pg.types.setTypeParser(pg.types.builtins.INT8, (v) => Number(v));

export function connect() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    console.error("DATABASE_URL이 없습니다. Vercel 운영 DB라면 먼저 `vercel env pull .env.local` 후 실행하세요.");
    process.exit(1);
  }
  // src/lib/db.ts의 strictSsl과 같은 이유로 인증서 검증을 명시한다
  return new pg.Client({ connectionString: url.replace(/([?&]sslmode=)(prefer|require|verify-ca)\b/, "$1verify-full") });
}

/** 같은 시점의 스냅샷(REPEATABLE READ)으로 전체를 읽는다. 서버가 돌아가는 중에도 안전하다. */
export async function dump(client) {
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    const q = async (sql) => (await client.query(sql)).rows;
    const data = {
      format: "linkmatch-backup/1",
      createdAt: new Date().toISOString(),
      draft: (await q("SELECT * FROM draft WHERE id = 1"))[0],
      teams: await q("SELECT * FROM teams ORDER BY id"),
      players: await q("SELECT * FROM players ORDER BY id"),
      picks: await q("SELECT * FROM picks ORDER BY pick_no"),
    };
    await client.query("COMMIT");
    return data;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  }
}

export const summary = (d) => `팀 ${d.teams.length} · 선수 ${d.players.length} · 픽 ${d.picks.length} · 드래프트 ${d.draft?.status}`;

export const stamp = () => new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
