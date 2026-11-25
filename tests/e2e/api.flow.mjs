// API 레벨 E2E: 드래프트 흐름 + 보안 점검. dev 서버가 떠 있어야 한다.
//   npm run dev  →  npm run test:e2e
//   BASE_URL=http://localhost:3000 ADMIN_TOKEN=dev-admin (기본값)
// 마지막 단계에서 주장 코드 대입 제한을 걸기 때문에, 끝난 뒤 10분간 잘못된 코드 시도가 막힌다.
// (카운터가 DB에 있으므로 서버를 재시작해도 유지된다. 바로 다시 돌리려면 DELETE FROM rate_limits;)
const B = process.env.BASE_URL ?? "http://localhost:3000";
const TOKEN = process.env.ADMIN_TOKEN ?? "dev-admin";
const JSON_H = { "content-type": "application/json" };
const ADMIN_H = { ...JSON_H, "x-admin-token": TOKEN };

let failed = 0;
const ok = (cond, msg) => {
  if (!cond) failed++;
  console.log(cond ? "  ✔" : "  ✘", msg);
};
const post = async (p, body, headers = JSON_H) => {
  const r = await fetch(B + p, { method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => ({})), headers: r.headers };
};
const admin = (action, extra = {}) => post("/api/admin", { action, ...extra }, ADMIN_H);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

console.log("■ 준비");
let s = (await admin("seed")).body;
ok(s.teams?.length === 8 && s.players?.length === 32, "샘플 데이터 8팀 · 32명");
s = (await admin("settings", { rounds: 3, pickSeconds: 10 })).body;
s = (await admin("start")).body;
ok(s.draft?.status === "running", "드래프트 시작");
const order = s.draft.order;
const codeOf = (id) => s.teams.find((t) => t.id === id).captainCode;
const free = () => s.players.filter((p) => !s.picks.some((k) => k.playerId === p.id));
const refresh = async () => (s = await (await fetch(B + "/api/admin", { headers: ADMIN_H })).json());

console.log("■ 지명 흐름");
let r = await post("/api/captain/login", { code: codeOf(order[0]).toLowerCase() });
ok(r.status === 200 && r.body.team.id === order[0], "소문자 코드도 로그인");
r = await post("/api/draft/pick", { code: codeOf(order[1]), playerId: free()[0].id });
ok(r.status === 403, `차례 아닌 팀 → 403 (${r.status})`);
const first = free()[0];
r = await post("/api/draft/pick", { code: codeOf(order[0]), playerId: first.id });
ok(r.status === 200 && r.body.picks.length === 1, "정상 지명");
await refresh();
r = await post("/api/draft/pick", { code: codeOf(order[1]), playerId: first.id });
ok(r.status === 409, `이미 지명된 선수 → 409 (${r.status})`);
const [a, b] = free();
const rs = await Promise.all([
  post("/api/draft/pick", { code: codeOf(order[1]), playerId: a.id }),
  post("/api/draft/pick", { code: codeOf(order[1]), playerId: b.id }),
]);
ok(rs.filter((x) => x.status === 200).length === 1, `같은 차례 동시 요청 중 1건만 성공 (${rs.map((x) => x.status)})`);
await refresh();
s = (await admin("pause")).body;
ok(s.draft.status === "paused" && s.draft.pausedLeftMs > 0, "일시정지 (남은 시간 보존)");
r = await post("/api/draft/pick", { code: codeOf(s.current.teamId), playerId: free()[0].id });
ok(r.status === 409, "일시정지 중 지명 → 409");
s = (await admin("resume")).body;
const before = s.picks.length;
s = (await admin("undo")).body;
ok(s.picks.length === before - 1, "마지막 픽 되돌리기");
s = (await admin("autopick")).body;
ok(s.picks.at(-1).auto, "강제 자동 지명");
const n0 = s.picks.length;
await sleep(10_800);
const pub = await (await fetch(B + "/api/state")).json();
ok(pub.picks.length === n0 + 1 && pub.picks.at(-1).auto, `제한 시간 초과 → 자동 지명 (${n0} → ${pub.picks.length})`);

console.log("■ 보안");
ok(!JSON.stringify(pub).includes("captainCode"), "공개 상태에 주장 코드 없음");
r = await fetch(B + "/api/admin");
ok(r.status === 401, `토큰 없이 관리자 API → 401 (${r.status})`);
r = await post("/api/admin", { action: "wipe" }, { ...JSON_H, "x-admin-token": "wrong" });
ok(r.status === 401, `잘못된 토큰으로 삭제 시도 → 401 (${r.status})`);
r = await post("/api/draft/pick", { code: codeOf(order[0]), playerId: "1 OR 1=1" });
ok(r.status === 400, `정수가 아닌 선수 ID → 400 (${r.status})`);
r = await admin("deleteTeam", { id: "abc" });
ok(r.status === 400, `관리자 API 정수 검증 → 400 (${r.status})`);
r = await post("/api/admin", JSON.stringify({ action: "addPlayers", text: "x".repeat(70_000) }), ADMIN_H);
ok(r.status === 413, `64KB 초과 본문 → 413 (${r.status})`);
await admin("reset");
r = await admin("addPlayers", { text: "가나다라마바사아자차카타파하가나다라마바사, B, 100, 4B" });
ok(r.status === 400 && /20자/.test(r.body.error), "닉네임 길이 제한 (20자)");
const XSS = "<b onclick=x>y</b>"; // 18자: 길이 제한 안쪽
r = await admin("addPlayers", { text: `${XSS}, B, 100, 4B` });
ok(r.status === 200, `HTML 문자열 닉네임은 텍스트로 저장 (${r.status})`);
const html = await (await fetch(B + "/teams")).text();
ok(!html.includes(XSS), "SSR HTML에 원본 태그가 그대로 나오지 않음 (이스케이프됨)");
const h = (await fetch(B + "/")).headers;
ok(h.get("x-frame-options") === "DENY" && h.get("x-content-type-options") === "nosniff", "보안 헤더 적용");
ok(!h.get("x-powered-by"), "x-powered-by 헤더 없음");

console.log("■ 대입 공격 제한 (마지막)");
let limited = 0;
for (let i = 0; i < 12; i++) {
  const x = await post("/api/captain/login", { code: `ZZZZ${String(i).padStart(2, "0")}` });
  if (x.status === 429) limited++;
}
ok(limited >= 2, `잘못된 코드 10회 후 429 (${limited}회 차단)`);
r = await post("/api/captain/login", { code: "ZZZZZZ" }, { ...JSON_H, "x-forwarded-for": "203.0.113.9" });
ok(r.status === 429, "x-forwarded-for 위조로 제한 우회 불가 (TRUST_PROXY 미설정)");

await admin("seed");
console.log(failed ? `\n실패 ${failed}건` : "\n모두 통과");
process.exit(failed ? 1 : 0);
