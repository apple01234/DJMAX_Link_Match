# DJMAX LINK MATCH 2027 — 대회 웹사이트 & 팀 드래프트 (초안)

LINK MATCH 2027 기술팀(웹) 스태프 지원용으로 만든 풀스택 프로토타입입니다.
대회 소개 페이지와, 주장들이 실시간으로 팀원을 지명하는 **스네이크 드래프트 시스템**을 포함합니다.

> 일정·규칙·참가자 데이터는 모두 예시입니다.

## 기술 스택

| 영역 | 사용 기술 |
| --- | --- |
| 프레임워크 | Next.js 16 (App Router, Route Handlers), React 19 |
| 언어 | TypeScript (strict) |
| 스타일 | Tailwind CSS v4 (`@theme` 디자인 토큰) |
| DB | Postgres — 운영은 Neon(Vercel 연동), 로컬은 Docker. 드라이버 `pg` |
| 배포 | Vercel |
| 그래픽 | WebGL2 프래그먼트 셰이더 (라이브러리 없이 직접 작성) |
| 테스트 | `node:test` (Node의 TS 타입 스트리핑으로 바로 실행) |

## 실행

Node.js 24 이상과 Postgres가 필요합니다. 로컬 Postgres는 Docker로 띄웁니다.

```bash
npm install
docker compose up -d             # 로컬 Postgres (compose.yaml)
cp .env.example .env.local       # DATABASE_URL이 로컬 Postgres를 가리킵니다
npm run dev                      # http://localhost:3000 (첫 요청 때 테이블을 만듭니다)
```

1. `/admin` 접속 → 토큰 `dev-admin` 입력 (개발 모드 기본값)
2. **샘플 데이터 넣기** → 8팀 · 32명 생성
3. **드래프트 시작**
4. 다른 브라우저(또는 시크릿 창)에서 `/draft` 접속 → 관리자 화면의 주장 코드로 로그인 → 지명

```bash
npm test             # 드래프트 로직 단위 테스트
npm run typecheck
npm run build
```

### 오프라인 데모 (서버 없이 파일 하나)

[`demo/linkmatch-demo.html`](demo/linkmatch-demo.html)을 브라우저로 열면 서버 없이 드래프트를 체험할 수 있습니다. 지원서에 첨부하는 용도입니다. 배포된 사이트에서는 `/demo`로 열립니다(빌드할 때 `public/demo.html`로 복사).

- 열면 드래프트가 바로 시작됩니다. 내 팀(Neon Pulse)은 3번째 순서이고 자동 로그인되며, 나머지 7팀은 2~5초 뒤 자동으로 지명합니다.
- 30초 안에 고르지 않으면 원본 규칙대로 레이팅이 가장 높은 선수가 자동 지명됩니다. 운영진 화면 토큰은 `demo`입니다.
- `src`의 컴포넌트를 그대로 쓰고, 서버 부분만 메모리 버전(`demo/src/mock/repo.ts`)으로 바꿔 끼웁니다. `src/lib/repo.ts`를 고치면 이 파일도 같이 고쳐야 합니다.
- 다시 빌드: `cd demo && npm install && npm run build`
- 데모는 브라우저 저장소 대신 메모리 저장소를 써서, 같은 주소의 실제 사이트에 주장 코드·운영진 토큰을 남기지 않습니다.

## 페이지

| 경로 | 내용 |
| --- | --- |
| `/` | 대회 소개. WebGL 히어로, D-day, 진행 방식, 일정 |
| `/teams` | 팀별 로스터 (드래프트 결과 반영) |
| `/draft` | 실시간 드래프트 보드: 타이머, 픽 순서 스트립, 선수 풀 검색·필터, 주장 로그인·지명, 로스터 |
| `/admin` | 팀·선수 일괄 등록(스프레드시트 붙여넣기 지원), 지명 순서 조정, 시작·일시정지·재개·되돌리기·강제 자동 지명·리셋 |
| `/privacy` | 운영 주체·문의처·저장하는 정보·보관 기간(대회 종료 후 30일) 안내 |
| `/demo` | 서버 없이 도는 오프라인 데모 (`public/demo.html`) |

## 설계 포인트

**1. 무결성은 DB 제약으로 강제**
- `picks.pick_no PRIMARY KEY`: 같은 차례에 두 번 지명할 수 없습니다.
- `picks.player_id UNIQUE`: 한 선수를 두 팀이 지명할 수 없습니다.
- 모든 쓰기는 트랜잭션 시작 때 드래프트 행을 `FOR UPDATE`로 잠근 뒤 "검사 → 쓰기"를 처리합니다. 서버(Vercel 인스턴스)가 여러 대여도 같은 차례의 동시 요청은 하나만 성공합니다(서버 2대에 20건을 동시에 보내 확인함).

**2. 크론 없는 시간 초과 처리 (lazy evaluation)**
- 픽 마감이 지나면 다음 요청이 들어올 때 서버가 자동 지명을 처리합니다. 대상은 레이팅이 가장 높은 선수입니다.
- 서버가 한동안 요청을 받지 않았다면 밀린 차례를 **각 마감 시각 기준으로** 순서대로 처리합니다.
- 백그라운드 워커가 필요 없어서 Vercel 같은 서버리스에서 그대로 동작합니다.

**3. 순수 로직 분리**
- [`src/lib/draft.ts`](src/lib/draft.ts)는 DB나 프레임워크에 의존하지 않는 순수 함수입니다(스네이크 순서, 슬롯 계산, 자동 지명 후보, 시작 조건). 서버 API와 클라이언트 보드가 같은 규칙을 공유합니다.
- 단위 테스트: [`tests/draft.test.ts`](tests/draft.test.ts)

**4. 실시간 갱신**
- 1.5초 간격으로 폴링하고, 탭이 보이지 않을 때는 멈춥니다. 서버 시각으로 클라이언트 시계를 보정해 카운트다운이 정확합니다.
- 전송 방식은 훅 하나([`usePolledState`](src/hooks/useDraftState.ts))에 격리되어 있어 SSE, WebSocket, Durable Objects로 바꾸기 쉽습니다.

**5. 보안**
- 주장 코드: 6자리이고 헷갈리는 문자(0/O, 1/I)를 뺐습니다. 공개 API(`/api/state`) 응답에는 포함하지 않습니다.
- 관리자 API: `x-admin-token` 헤더를 `timingSafeEqual`로 비교합니다. 프로덕션에서 `ADMIN_TOKEN`이 없으면 관리자 API가 막힙니다.

**6. WebGL 히어로**
- 원근 레인과 떨어지는 노트, 128 BPM에 맞춰 깜빡이는 판정선을 셰이더 하나로 그립니다. 풀스크린 삼각형 1개만 사용합니다.
- 접근성과 성능을 위해 다음을 처리했습니다.
  - `prefers-reduced-motion`이면 정지 프레임을 보여줍니다.
  - 화면 밖에 있으면 렌더 루프를 멈춥니다.
  - DPR은 1.5로 제한합니다.
  - WebGL2를 지원하지 않으면 CSS 그라디언트로 대체합니다.

## API

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/api/state` | 공개 상태 (팀·선수·픽·현재 차례·마감 시각·서버 시각) |
| POST | `/api/captain/login` | `{ code }` → 팀 정보 |
| POST | `/api/draft/pick` | `{ code, playerId }` → 지명 후 상태 |
| GET | `/api/admin` | 관리자 상태 (주장 코드 포함) |
| POST | `/api/admin` | `{ action, ... }` — `addTeams`, `addPlayers`, `start`, `pause`, `resume`, `autopick`, `undo`, `reset`, `shuffleOrder`, `moveTeam`, `settings`, `seed`, `wipe` 등 |

## 구조

```
src/
  app/                 페이지 + API 라우트
  components/
    HeroCanvas.tsx     WebGL2 히어로
    draft/             드래프트 보드 (DraftRoom, PickClock, OrderStrip)
    admin/             관리자 패널
  hooks/               폴링 + 서버 시계 보정
  lib/
    draft.ts           순수 드래프트 규칙
    db.ts              Postgres 연결·스키마·트랜잭션
    repo.ts            드래프트 엔진·쿼리
    ratelimit.ts       주장 코드·관리자 토큰 대입 제한 (카운터는 DB에)
scripts/               DB 백업·복원 (JSON)
tests/                 node:test 단위 테스트
  e2e/api.flow.mjs     드래프트 흐름 + 보안 E2E (dev 서버 필요)
```

## 운영

환경 변수는 [`.env.example`](.env.example)에 정리되어 있습니다.

| 변수 | 용도 |
| --- | --- |
| `DATABASE_URL` | Postgres 접속 주소. Vercel에서 Neon을 연결하면 자동으로 들어갑니다 |
| `ADMIN_TOKEN` | 운영진 토큰. **프로덕션에서 비워두면 관리자 API가 막힙니다.** 32자 이상 무작위 값 |
| `TRUST_PROXY` | Vercel에서는 쓰지 않습니다. 그 밖의 서버에서 IP 헤더를 덮어쓰는 프록시 뒤에 있을 때만 `1` |
| `ALLOW_SAMPLE_SEED` | 운영에서 "샘플 데이터 넣기"를 허용하려면 `1` (기본 차단) |

**Vercel 배포**

1. Vercel 프로젝트 → **Storage** → **Create Database** → **Neon** → 이 프로젝트에 연결합니다. `DATABASE_URL`이 자동으로 들어갑니다.
2. **Settings → Environment Variables**에 `ADMIN_TOKEN`을 넣습니다. 값은 `node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"`로 만듭니다.
3. `main`에 푸시하면 배포됩니다. 테이블은 첫 요청 때 자동으로 만들어집니다.

- 서버리스라 인스턴스가 여러 개 뜰 수 있어서, 드래프트 상태와 대입 제한 카운터를 모두 DB에 둡니다.
- 접속 IP는 Vercel이 덮어쓰는 `x-real-ip`만 읽습니다. 클라이언트가 보낸 `cf-connecting-ip` 같은 헤더로 대입 제한을 우회할 수 없습니다.
- 대입 제한 기록에는 IP를 그대로 남기지 않고 `ADMIN_TOKEN`으로 HMAC한 값만 저장합니다. 10분 집계가 끝난 기록은 다음 요청 때 지웁니다.
- 공개 상태(`/api/state`)는 `draft.version`을 `ETag`로 보내고, 바뀌지 않았으면 304로 답합니다. 관전자가 많아도 DB 읽기와 전송량이 거의 늘지 않습니다.
- 드래프트 당일에는 배포하지 않습니다.

**백업**

```bash
npm run backup                                  # backups/linkmatch-YYYYMMDD-HHMMSS.json (최근 14개 보관)
npm run restore -- backups/<파일>                # 복원 (현재 상태를 before-restore-*.json으로 먼저 보관)
```

- 운영 DB를 백업하려면 `vercel env pull .env.local`로 `DATABASE_URL`을 받은 뒤 `node --env-file=.env.local scripts/backup.mjs`를 실행합니다.
- 백업은 한 시점의 스냅숏(`REPEATABLE READ`)이라 서버가 실행 중일 때도 안전합니다.
- 복원은 트랜잭션 하나라 중간에 실패하면 아무것도 바뀌지 않습니다. 드래프트를 일시정지한 뒤 실행하세요.
- Neon 자체의 시점 복원(branch restore)도 함께 쓸 수 있습니다.

## 검증

```bash
npm run typecheck && npm test && npm run build
npm run dev   # 다른 터미널에서 (로컬 Postgres 필요)
npm run test:e2e
```

`npm run dev`가 켜져 있는 동안 `npm run build`를 실행하지 마세요. 둘이 `.next` 폴더를 함께 써서 dev 서버가 페이지를 계속 새로고침하는 상태가 됩니다. 이미 그렇게 됐다면 dev 서버를 끄고 `.next`를 지운 뒤 다시 켜면 됩니다.

`test:e2e`는 마지막에 주장 코드 대입 제한을 일부러 겁니다. 카운터가 DB에 있어서 끝난 뒤 10분 동안은 서버를 재시작해도 잘못된 코드 입력이 막힙니다. 바로 다시 돌리려면 `DELETE FROM rate_limits;`를 실행하세요.

## 다음 단계 (아이디어)

- 실시간성이 더 필요하면 폴링 대신 SSE로 바꿉니다(`usePolledState` 훅 하나만 교체).
- 디스코드 OAuth로 주장 인증
- 드래프트 이벤트 로그와 다시보기, 방송 송출용 오버레이 화면(`/draft?overlay`)
- 대진표와 경기 결과 입력
