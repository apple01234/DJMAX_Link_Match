import Link from "next/link";
import { HeroCanvas } from "@/components/HeroCanvas";
import { LiveDraft } from "@/components/LiveDraft";
import { SectionTitle } from "@/components/ui";
import type { PublicState } from "@/lib/types";

// 2027-01-30 00:00 KST
const EVENT_START = Date.UTC(2027, 0, 29, 15, 0, 0);

const SCHEDULE = [
  { date: "12.—", day: "", title: "참가 신청 · 주장 선정", desc: "개인 단위 신청. 운영진이 주장을 정하고 주장 코드를 전달합니다." },
  { date: "01.—", day: "", title: "팀 드래프트", desc: "이 사이트의 드래프트 보드에서 온라인으로 진행합니다. 누구나 관전할 수 있습니다." },
  { date: "01.30", day: "SAT", title: "본선 1일 차", desc: "조별 리그, 8강" },
  { date: "01.31", day: "SUN", title: "본선 2일 차", desc: "4강, 결승, 시상" },
];

/** 홈 화면. 상태는 페이지(서버)가 읽어서 넘긴다 — 오프라인 데모도 같은 화면을 쓴다. */
export function HomeView({ s }: { s: PublicState }) {
  const days = Math.ceil((EVENT_START - s.serverNow) / 86_400_000);
  const dday = days > 0 ? `D-${days}` : days === 0 ? "D-DAY" : "END";

  return (
    <main>
      {/* 타이틀 밴드: 대회명 + 본선까지 남은 날 */}
      <section className="border-b border-line">
        <div className="lanes mx-auto grid max-w-[1400px] gap-6 px-4 pt-10 pb-8 md:grid-cols-[1fr_auto] md:items-end">
          <div className="min-w-0">
            <p className="label">DJMAX · Team Draft Tournament</p>
            <h1 className="mt-3 font-display text-[clamp(4rem,11vw,9.5rem)] leading-[0.82] font-black tracking-tight uppercase">
              Link Match
              <span className="block text-chrome">2027</span>
            </h1>
          </div>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-1 md:text-right">
            <div>
              <dt className="label">본선까지</dt>
              <dd className="score text-5xl whitespace-nowrap text-ink sm:text-7xl">{dday}</dd>
            </div>
            <div>
              <dt className="label">본선</dt>
              <dd className="score text-5xl whitespace-nowrap text-chrome sm:text-7xl">01.30–31</dd>
            </div>
          </dl>
        </div>
        {/* 판정선: 페이지에서 시안을 쓰는 유일한 곳 */}
        <div aria-hidden className="h-px bg-judge shadow-[0_0_12px_1px] shadow-judge/60" />
      </section>

      {/* 상황판: 실시간 드래프트 + 기어 화면 */}
      <section className="mx-auto grid max-w-[1400px] gap-4 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <LiveDraft initial={s} />
        {/* 캔버스는 aria-hidden, 재생 버튼은 키보드로 닿아야 하므로 감싸는 칸에는 aria-hidden을 두지 않는다 */}
        <div className="cut relative min-h-[380px] bg-[#06070a] lg:min-h-[460px]">
          <HeroCanvas placement="screen" className="absolute inset-0 size-full" />
        </div>
      </section>

      {/* 규칙: 게임 모드 선택 화면처럼 수치만 */}
      <section className="mx-auto max-w-[1400px] px-4 py-10">
        <SectionTitle
          title="드래프트 규칙"
          desc="주장이 선수 풀에서 팀원을 직접 고릅니다. 1라운드는 정방향, 2라운드는 역방향(스네이크)으로 지명하고, 제한 시간이 지나면 남은 선수 중 레이팅이 가장 높은 선수가 자동 지명됩니다."
        />
        <dl className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
          {[
            { k: "Teams", v: String(s.teams.length).padStart(2, "0"), u: "팀" },
            { k: "Rounds", v: String(s.draft.rounds).padStart(2, "0"), u: "라운드" },
            { k: "Pick time", v: String(s.draft.pickSeconds), u: "초" },
            { k: "Player pool", v: String(s.players.length).padStart(2, "0"), u: "명" },
          ].map((it) => (
            <div key={it.k} className="bg-bg px-4 py-5">
              <dt className="label">{it.k}</dt>
              <dd className="mt-2 flex items-baseline gap-1.5">
                <span className="score text-5xl">{it.v}</span>
                <span className="text-sm text-mute">{it.u}</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* 일정 */}
      <section className="mx-auto max-w-[1400px] px-4 pb-10">
        <SectionTitle title="일정" desc="예시 일정입니다. 확정되면 이곳에 공지합니다." />
        <ol className="border-t border-line">
          {SCHEDULE.map((it, i) => (
            <li key={it.title} className="grid grid-cols-[5.5rem_1fr] gap-x-4 border-b border-line py-4 sm:grid-cols-[8rem_16rem_1fr] sm:items-baseline">
              <span className={"score text-3xl " + (i >= 2 ? "text-ink" : "text-mute")}>
                {it.date}
                {it.day && <span className="label ml-2 align-middle">{it.day}</span>}
              </span>
              <span className="font-bold">{it.title}</span>
              <span className="col-start-2 text-sm text-mute sm:col-start-auto">{it.desc}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* 참가 팀 */}
      {s.teams.length > 0 && (
        <section className="mx-auto max-w-[1400px] px-4 pb-16">
          <SectionTitle
            title="참가 팀"
            aside={
              <Link href="/teams" className="font-mono text-xs font-semibold text-mute hover:text-ink">
                로스터 전체 →
              </Link>
            }
          />
          <ul className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
            {s.teams.map((t, i) => (
              <li key={t.id} className="relative bg-bg py-4 pr-3 pl-5">
                <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: t.color }} />
                <span className="label tabular">Team {String(i + 1).padStart(2, "0")}</span>
                <p className="mt-1 leading-snug font-black">{t.name}</p>
                <p className="mt-0.5 text-xs text-mute">주장 {t.captain}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
