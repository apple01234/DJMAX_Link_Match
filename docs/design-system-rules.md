# 디자인 시스템 규칙 — LINK MATCH 2027

> Figma 디자인을 코드로 옮기거나 새 화면을 만들 때 따르는 규칙입니다. 사람과 AI 에이전트 모두를 위해 씁니다.
> 출처: `src/app/globals.css`, `src/components/ui.tsx`, `src/app/layout.tsx`. 값은 이 저장소의 코드와 대조해 같음을 확인했습니다. 코드를 바꾸면 이 문서도 같이 고쳐 주세요.

## 0. 방향 한 줄

**리듬게임 대회 방송 그래픽.** 기어 안쪽처럼 어두운 바탕, 모서리를 깎은 HUD 패널, 점수판 숫자. 랜딩 페이지 템플릿처럼 보이면 실패입니다.

## 1. 토큰 (Tailwind v4 `@theme`)

새 색을 만들지 말고 아래 토큰만 씁니다. 임의 색(`bg-[#...]`)은 금지입니다. 예외는 `Button`의 primary 호버 색 하나뿐입니다.

| 토큰 | 값 | 용도 |
|---|---|---|
| `bg` | `#0b0d11` | 페이지 바탕 |
| `panel` | `#12151b` | HUD 패널 |
| `panel-2` | `#191d25` | 패널 안의 한 단계 위 표면, 입력창 |
| `line` | `#252a34` | 구분선, 레인 격자 |
| `ink` | `#e7e9ee` | 본문 |
| `mute` | `#8a909d` | 보조 글자, 라벨 |
| `chrome` | `#c8cdd6` | 은색 노트. 정보 강조, 연도 숫자 |
| `accent` | `#3d7bff` | 블루 노트. **조작 가능한 것**(버튼, 선택 상태)에만 |
| `live` | `#ff3b30` | LIVE 표시, 10초 이하 긴급 타이머, 사이드 노트 |
| `judge` | `#5ad7ff` | 판정선 시안. **가는 선(1px)과 포커스 링에만** |
| `gold` | `#ffc23d` | S티어만 |
| `danger` | `#ff5a6e` | 파괴적 동작(되돌리기, 초기화) |
| `ok` | `#4fd98a` | 성공 메시지 |

### 색 규칙
- 색은 **기능색**입니다. 장식으로 쓰지 않습니다. 파란 글자는 "누를 수 있다", 빨강은 "지금/긴급"을 뜻합니다.
- `judge`(시안)는 한 화면에 한 군데만 씁니다. 홈에서는 타이틀 밴드 아래 판정선 하나입니다.
- 팀 색은 DB 값(`team.color`)을 씁니다. 팀 색은 **세로 바(`TeamDot`, 폭 4px)** 로만 보여주고, 글자색이나 배경 전체에는 쓰지 않습니다(대비 문제).
- 그라데이션은 노트 모양(`note`, `note-blue`)에만 씁니다. 배경 그라데이션과 보라색 계열은 쓰지 않습니다.

## 2. 글꼴

| 역할 | 글꼴 | 유틸리티 |
|---|---|---|
| 한국어 본문 | Pretendard Variable | `font-sans`(기본) |
| 큰 제목, 점수판 숫자 | Big Shoulders Display 700–900 | `font-display`, `score` |
| 라벨, 데이터, 코드 | IBM Plex Mono 500–600 | `font-mono`, `label` |

- 숫자가 바뀌는 곳(타이머, 픽 번호, 레이팅)은 반드시 `tabular`나 `score`를 씁니다. 폭이 흔들리면 안 됩니다.
- `label`: 11px, 600, 자간 0.12em, 대문자, `mute`. 영어 라벨(`On the clock`, `Time left`)과 짧은 한국어 라벨에 씁니다.
- Inter는 쓰지 않습니다.
- 한국어는 `word-break: keep-all`(전역 적용됨)입니다. 제목은 `text-wrap: balance`입니다.

## 3. 모양과 레이아웃

- **패널:** `Card` 컴포넌트(`cut bg-panel`)를 씁니다. 오른쪽 위와 왼쪽 아래 모서리를 14px 깎습니다. 작은 요소는 `cut-sm`(8px)을 씁니다.
- **둥근 모서리(`rounded-*`)는 쓰지 않습니다.** 예외: 원형 아바타가 생기면 그때 정합니다.
- 테두리보다 **바탕 명도 차**로 구분합니다(`bg` → `panel` → `panel-2`). 그림자와 글로우는 쓰지 않습니다. 판정선 하나만 예외입니다.
- 배경 격자: 넓은 영역에는 `lanes`(8레인, 12.5% 간격)를 씁니다. 격자 위에 다시 격자를 겹치지 않습니다.
- 최대 폭 `max-w-[1400px]`, 좌우 여백 `px-4`. 375px에서 가로 스크롤이 생기면 안 됩니다.
- 구획 제목은 `SectionTitle`을 씁니다(은색 노트 마커 + 제목 + 설명).

## 4. 컴포넌트 매핑 (Figma → 코드)

| Figma 이름(권장) | 코드 | 변형 |
|---|---|---|
| `Button` | `@/components/ui` `Button` | variant: primary / outline / ghost / danger, size: sm(32px) / md(40px) |
| `Panel` | `Card` | — |
| `Tier` | `TierBadge` | S(gold) / A(chrome) / B / C. 24×24, 고정폭 |
| `Team Bar` | `TeamDot` | color 속성 |
| `Section Header` | `SectionTitle` | title, desc?, aside? |
| `Live Board` | `LiveDraft` | setup / running / paused / done |
| `Pick Clock` | `draft/PickClock` | 기본 / 10초 이하 urgent |
| `Order Strip` | `draft/OrderStrip` | — |
| `Gear` | `HeroCanvas` (WebGL) | placement: hero / screen. Figma에서는 정지 이미지로 대체 |

새 컴포넌트를 만들기 전에 위 표에 있는 것을 조합할 수 있는지 먼저 확인합니다.

## 5. 움직임

- 기본 이징 `--ease-out-quick`(`cubic-bezier(0.23, 1, 0.32, 1)`). 시간은 120–260ms입니다.
- 등장: `animate-pop`(새 픽), `animate-slide`(목록 항목), `animate-fade`, `animate-drop`(알림).
- 긴급: `animate-urgent`(0.6초 깜빡임)는 남은 시간 10초 이하의 타이머에만 씁니다.
- 누름: `press`(scale 0.97).
- `prefers-reduced-motion`이면 모두 끕니다(전역 처리됨). 새 애니메이션을 추가하면 이 목록에도 넣어야 합니다.

## 6. 접근성

- 포커스: `:focus-visible`에 2px `judge` 외곽선(전역). 지우지 않습니다.
- 터치 대상은 최소 32px(`Button sm`)입니다. 주요 동작(지명)은 40px 이상입니다.
- 색만으로 상태를 알리지 않습니다. LIVE에는 글자를, 티어에는 문자(GM/M/DM/PT/GD…)와 한글 이름(aria-label·title)을, 타이머에는 `aria-label`을 붙입니다.
- `mute` 글자는 `bg`와 `panel` 위에서만 씁니다. `panel-2` 위의 작은 글자는 `ink`로 씁니다(대비 확보).

## 7. 게임 에셋

- 공식 게임 이미지, 로고, 스킨을 가져다 쓰지 않습니다. 기어는 배치만 참고해서 셰이더와 CSS로 직접 그립니다(이전 세션 원칙).
- 레인별 노트 색은 공식 출처를 확인하지 못했습니다. 현재는 은·블루·은 | 은·블루·은의 대칭 배치입니다.

## 8. 체크리스트 (PR 전)

- [ ] 토큰에 없는 색, `rounded-*`, 그림자를 쓰지 않았다
- [ ] 바뀌는 숫자에 `tabular` 또는 `score`를 썼다
- [ ] 시안은 한 화면에 한 군데만 썼다
- [ ] 375px에서 가로 스크롤이 없다
- [ ] 새 애니메이션을 reduced-motion 목록에 넣었다
