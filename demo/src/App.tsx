import { useEffect, useSyncExternalStore } from "react";
import { Nav } from "@/components/Nav";
import { HomeView } from "@/components/HomeView";
import { TeamsView } from "@/components/TeamsView";
import DraftPage from "../../src/app/draft/page";
import AdminPage from "../../src/app/admin/page";
import { usePathname } from "./shims/next";
import { getPublicState, subscribe, version } from "./mock/repo";
import { HUMAN_TEAM_NAME, humanCode } from "./boot";

const ROUTES: Record<string, { title: string; Page: () => React.ReactNode }> = {
  // 원본 페이지는 서버에서 상태를 읽어 넘긴다. 데모는 메모리 서버에서 읽어 같은 화면에 넘긴다.
  "/": { title: "", Page: () => <HomeView s={getPublicState()} /> },
  "/draft": { title: "드래프트", Page: DraftPage },
  "/teams": { title: "참가 팀", Page: () => <TeamsView s={getPublicState()} /> },
  "/admin": { title: "관리자", Page: AdminPage },
};

/** src/app/layout.tsx의 <body> 부분 + 데모 안내 막대 */
export function App() {
  const path = usePathname();
  // 서버 렌더 페이지(홈·참가 팀)는 상태가 바뀔 때마다 다시 그린다 (원본은 요청마다 서버에서 렌더)
  useSyncExternalStore(subscribe, version);
  const route = ROUTES[path] ?? ROUTES["/"];

  useEffect(() => {
    document.title = route.title ? `${route.title} · LINK MATCH 2027` : "DJMAX LINK MATCH 2027";
  }, [route.title]);

  return (
    <div className="min-h-dvh bg-bg pb-24 font-sans text-ink antialiased sm:pb-14">
      <Nav />
      <route.Page key={path} />
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-6">
          <span className="label">DJMAX LINK MATCH 2027</span>
          <span className="label">2027.01.30 – 01.31</span>
          <p className="w-full text-xs text-mute sm:ml-auto sm:w-auto">
            스태프 지원용 초안입니다. 일정·규칙·참가자 정보는 예시입니다.
          </p>
        </div>
      </footer>
      <DemoBar />
    </div>
  );
}

function DemoBar() {
  return (
    <aside
      aria-label="데모 안내"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-panel/95 backdrop-blur-sm"
    >
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-xs">
        <span className="bg-accent px-1.5 py-0.5 font-mono text-[11px] font-semibold text-white">DEMO</span>
        <span className="text-mute">
          서버 없이 이 파일 하나로 돌아가는 시뮬레이션입니다. 내 팀은{" "}
          <b className="text-ink">{HUMAN_TEAM_NAME}</b>(주장 코드{" "}
          <b className="tabular font-mono text-ink">{humanCode()}</b>, 자동 로그인)이고, 나머지 7팀은 자동으로 지명합니다.
          운영진 화면 토큰은 <b className="font-mono text-ink">demo</b>입니다.
        </span>
        <button
          type="button"
          onClick={() => location.reload()}
          className="press ml-auto min-h-8 cursor-pointer border border-line bg-panel-2 px-2.5 font-semibold hover:border-chrome/50"
        >
          처음부터 다시
        </button>
      </div>
    </aside>
  );
}
