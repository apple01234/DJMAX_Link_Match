"use client";

import { useEffect, useMemo, useState } from "react";
import { usePolledState } from "@/hooks/useDraftState";
import { api, cn, formatClock, STATUS_LABEL } from "@/lib/client";
import { totalPicks } from "@/lib/draft";
import type { AdminState } from "@/lib/types";
import { Button, Card, TeamDot, TierBadge } from "@/components/ui";

const TOKEN_KEY = "linkmatch27.adminToken";

export function AdminPanel() {
  const [token, setToken] = useState<string | null>(null);
  const [input, setInput] = useState("");

  useEffect(() => {
    try {
      setToken(sessionStorage.getItem(TOKEN_KEY));
    } catch {}
  }, []);

  const headers = useMemo(() => (token ? { "x-admin-token": token } : undefined), [token]);
  const { state, error, now, accept } = usePolledState<AdminState>(token ? "/api/admin" : null, 2000, headers);

  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const act = async (action: string, payload: Record<string, unknown> = {}, ok?: string) => {
    if (!token) return false;
    setBusy(action);
    setActionError(null);
    setNotice(null);
    try {
      const res = await api<AdminState & { message?: string }>("/api/admin", {
        json: { action, ...payload },
        headers: { "x-admin-token": token },
      });
      accept(res);
      if (res.message ?? ok) setNotice(res.message ?? ok ?? null);
      return true;
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const unauthorized = error?.includes("토큰");

  if (!token || (unauthorized && !state)) {
    return (
      <main className="mx-auto grid min-h-[70svh] max-w-sm place-items-center px-4">
        <Card className="w-full p-6">
          <h1 className="text-xl font-black">운영진 로그인</h1>
          <p className="mt-1 text-xs text-mute">운영진에게 공유된 관리자 토큰을 입력하세요.</p>
          {/* 개발 빌드에서만 보이는 안내. 프로덕션 번들에서는 이 분기 전체가 제거된다. */}
          {process.env.NODE_ENV !== "production" && (
            <p className="mt-2 bg-white/5 px-2.5 py-1.5 text-xs text-mute">
              개발 모드 기본 토큰: <code className="text-accent">dev-admin</code>
            </p>
          )}
          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              try {
                sessionStorage.setItem(TOKEN_KEY, input);
              } catch {}
              setToken(input);
            }}
          >
            <input
              type="password"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="관리자 토큰"
              className="h-10 min-w-0 flex-1 border border-line bg-panel-2 px-3 text-sm outline-none focus:border-accent/60"
            />
            <Button variant="primary" type="submit" disabled={!input}>
              확인
            </Button>
          </form>
          {unauthorized && <p className="mt-2 text-xs text-danger">{error}</p>}
        </Card>
      </main>
    );
  }

  if (!state) {
    return <main className="px-4 py-16 text-center text-mute">불러오는 중…</main>;
  }

  const d = state.draft;
  const setup = d.status === "setup";
  const active = d.status === "running" || d.status === "paused";
  const total = totalPicks(d.order.length, d.rounds);
  const teamById = new Map(state.teams.map((t) => [t.id, t]));
  const pickedIds = new Set(state.picks.map((p) => p.playerId));
  const current = state.current && teamById.get(state.current.teamId);
  const msLeft = d.status === "running" && state.deadline ? state.deadline - now : (d.pausedLeftMs ?? 0);

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-black">관리자</h1>
        <span className="rounded-full border border-line px-2.5 py-0.5 text-xs font-bold">{STATUS_LABEL[d.status]}</span>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={() => {
            try {
              sessionStorage.removeItem(TOKEN_KEY);
            } catch {}
            setToken(null);
          }}
        >
          로그아웃
        </Button>
      </div>

      {(actionError || notice) && (
        <p
          className={cn(
            "mb-4 px-4 py-2.5 text-sm",
            actionError ? "bg-danger/10 text-danger" : "bg-ok/10 text-ok",
          )}
        >
          {actionError ?? notice}
        </p>
      )}

      {/* 진행 제어 */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div>
            <p className="text-xs text-mute">진행 상황</p>
            <p className="tabular mt-0.5 font-bold">
              {state.picks.length} / {total} 픽
              {current && (
                <span className="ml-2 text-sm font-semibold" style={{ color: current.color }}>
                  · {current.name} 차례 {active && `(${formatClock(msLeft)})`}
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            {setup && (
              <Button variant="primary" disabled={!!busy} onClick={() => act("start", {}, "드래프트를 시작했습니다.")}>
                드래프트 시작
              </Button>
            )}
            {d.status === "running" && (
              <Button disabled={!!busy} onClick={() => act("pause")}>
                일시정지
              </Button>
            )}
            {d.status === "paused" && (
              <Button variant="primary" disabled={!!busy} onClick={() => act("resume")}>
                재개
              </Button>
            )}
            {active && (
              <Button disabled={!!busy} onClick={() => act("autopick", {}, "현재 차례를 자동 지명했습니다.")}>
                지금 자동 지명
              </Button>
            )}
            {!setup && (
              <Button disabled={!!busy || state.picks.length === 0} onClick={() => act("undo", {}, "마지막 픽을 되돌렸습니다.")}>
                마지막 픽 되돌리기
              </Button>
            )}
            {!setup && (
              <Button
                variant="danger"
                disabled={!!busy}
                onClick={() => confirm("모든 픽을 지우고 준비 단계로 돌아갈까요?") && act("reset", {}, "초기화했습니다.")}
              >
                드래프트 리셋
              </Button>
            )}
          </div>
        </div>

        <SettingsForm
          key={`${d.rounds}-${d.pickSeconds}`}
          rounds={d.rounds}
          pickSeconds={d.pickSeconds}
          disabled={!setup || !!busy}
          onSave={(rounds, pickSeconds) => act("settings", { rounds, pickSeconds }, "설정을 저장했습니다.")}
        />
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 팀 */}
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <h2 className="font-black">팀 · 1라운드 지명 순서</h2>
            <span className="text-xs text-mute">{state.teams.length}팀</span>
            <Button size="sm" className="ml-auto" disabled={!setup || !!busy} onClick={() => act("shuffleOrder")}>
              순서 무작위
            </Button>
          </div>
          <ol className="mt-3 divide-y divide-line/60">
            {d.order.map((id, i) => {
              const t = teamById.get(id);
              if (!t) return null;
              return (
                <li key={id} className="flex items-center gap-2 py-2 text-sm">
                  <span className="tabular w-5 text-xs text-mute">{i + 1}</span>
                  <TeamDot color={t.color} />
                  <span className="min-w-0 flex-1 truncate">
                    <b>{t.name}</b> <span className="text-mute">· {t.captain}</span>
                  </span>
                  <button
                    type="button"
                    title="주장 코드 복사"
                    onClick={() => navigator.clipboard?.writeText(t.captainCode)}
                    className="tabular cursor-pointer rounded bg-white/6 px-2 py-0.5 font-mono text-xs tracking-widest hover:bg-white/12"
                  >
                    {t.captainCode}
                  </button>
                  <Button size="sm" variant="ghost" title="코드 재발급" disabled={!!busy} onClick={() => act("regenCode", { id })}>
                    ↻
                  </Button>
                  <Button size="sm" variant="ghost" disabled={!setup || i === 0} onClick={() => act("moveTeam", { id, delta: -1 })}>
                    ↑
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!setup || i === d.order.length - 1}
                    onClick={() => act("moveTeam", { id, delta: 1 })}
                  >
                    ↓
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="hover:text-danger"
                    disabled={!setup}
                    onClick={() => confirm(`'${t.name}' 팀을 삭제할까요?`) && act("deleteTeam", { id })}
                  >
                    ✕
                  </Button>
                </li>
              );
            })}
          </ol>
          <BulkAdd
            disabled={!setup || !!busy}
            placeholder={"팀명, 주장\nNeon Pulse, 하람\nMidnight Lane, 서진"}
            hint="한 줄에 한 팀 · 쉼표 또는 탭으로 구분 · 준비 단계에서만 추가 가능"
            onSubmit={(text) => act("addTeams", { text }, "팀을 추가했습니다.")}
          />
        </Card>

        {/* 선수 */}
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <h2 className="font-black">선수 풀</h2>
            <span className="text-xs text-mute">
              {state.players.length}명 · 필요 {d.order.length * d.rounds}명
            </span>
            <Button
              size="sm"
              className="ml-auto"
              title="닉네임으로 V-ARCHIVE의 8B 티어 점수를 조회해 레이팅을 채웁니다"
              disabled={d.status === "done" || state.players.length === 0 || !!busy}
              onClick={() =>
                confirm(
                  "V-ARCHIVE에서 선수 닉네임으로 8B 티어 점수를 조회해 레이팅을 덮어씁니다.\n찾지 못한 선수는 그대로 둡니다. 한 명씩 조회하므로 시간이 걸릴 수 있습니다.",
                ) && act("importRatings")
              }
            >
              {busy === "importRatings" ? "불러오는 중…" : "V-ARCHIVE 8B 불러오기"}
            </Button>
          </div>
          <div className="scrollbar-thin mt-3 max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-panel text-left text-xs text-mute">
                <tr>
                  <th className="py-1.5 font-medium">닉네임</th>
                  <th className="font-medium">티어</th>
                  <th className="text-right font-medium">레이팅</th>
                  <th className="pl-3 font-medium">키</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-line/50">
                {state.players.map((p) => (
                  <tr key={p.id} className={cn(pickedIds.has(p.id) && "opacity-40")}>
                    <td className="max-w-40 truncate py-1.5 font-semibold">{p.nickname}</td>
                    <td>
                      <TierBadge tier={p.tier} />
                    </td>
                    <td className="tabular text-right">{p.rating.toLocaleString()}</td>
                    <td className="pl-3 text-mute">{p.mainKey}</td>
                    <td className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="hover:text-danger"
                        disabled={pickedIds.has(p.id) || !!busy}
                        onClick={() => act("deletePlayer", { id: p.id })}
                      >
                        ✕
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <BulkAdd
            disabled={d.status === "done" || !!busy}
            placeholder={"닉네임, 티어(S/A/B/C), 레이팅, 주력키(4B/5B/6B/8B), 메모\nRin, A, 8120, 6B, 하드 채보 강함"}
            hint="스프레드시트에서 그대로 복사해 붙여넣어도 됩니다 (탭 구분)"
            onSubmit={(text) => act("addPlayers", { text }, "선수를 추가했습니다.")}
          />
        </Card>
      </div>

      {/* 데이터 */}
      <Card className="mt-6 flex flex-wrap items-center gap-3 p-5">
        <div className="mr-auto">
          <h2 className="font-black">데이터</h2>
          <p className="text-xs text-mute">데모용 샘플(8팀 · 32명)을 넣거나 전체를 비웁니다.</p>
        </div>
        <Button
          disabled={!setup || !!busy}
          onClick={() =>
            confirm("기존 데이터를 모두 지우고 샘플 데이터를 넣을까요?") && act("seed", {}, "샘플 데이터를 넣었습니다.")
          }
        >
          샘플 데이터 넣기
        </Button>
        <Button
          variant="danger"
          disabled={!!busy}
          onClick={() => confirm("팀·선수·픽을 모두 삭제합니다. 되돌릴 수 없습니다.") && act("wipe", {}, "모두 삭제했습니다.")}
        >
          전체 삭제
        </Button>
      </Card>
    </main>
  );
}

function SettingsForm({
  rounds,
  pickSeconds,
  disabled,
  onSave,
}: {
  rounds: number;
  pickSeconds: number;
  disabled: boolean;
  onSave: (rounds: number, pickSeconds: number) => void;
}) {
  const [r, setR] = useState(String(rounds));
  const [s, setS] = useState(String(pickSeconds));
  return (
    <form
      className="mt-5 flex flex-wrap items-end gap-3 border-t border-line/60 pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(Number(r), Number(s));
      }}
    >
      <label className="text-xs text-mute">
        라운드 (팀당 지명 인원)
        <input
          type="number"
          min={1}
          max={10}
          value={r}
          onChange={(e) => setR(e.target.value)}
          disabled={disabled}
          className="tabular mt-1 block h-9 w-28 border border-line bg-panel-2 px-3 text-sm text-ink outline-none focus:border-accent/60 disabled:opacity-50"
        />
      </label>
      <label className="text-xs text-mute">
        픽 제한 시간 (초)
        <input
          type="number"
          min={10}
          max={600}
          value={s}
          onChange={(e) => setS(e.target.value)}
          disabled={disabled}
          className="tabular mt-1 block h-9 w-28 border border-line bg-panel-2 px-3 text-sm text-ink outline-none focus:border-accent/60 disabled:opacity-50"
        />
      </label>
      <Button type="submit" size="sm" className="h-9" disabled={disabled}>
        설정 저장
      </Button>
      {disabled && <span className="pb-2 text-xs text-mute">설정은 준비 단계에서만 바꿀 수 있습니다.</span>}
    </form>
  );
}

function BulkAdd({
  placeholder,
  hint,
  disabled,
  onSubmit,
}: {
  placeholder: string;
  hint: string;
  disabled: boolean;
  onSubmit: (text: string) => Promise<boolean>;
}) {
  const [text, setText] = useState("");
  return (
    <form
      className="mt-4 border-t border-line/60 pt-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await onSubmit(text)) setText("");
      }}
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        rows={4}
        disabled={disabled}
        className="w-full resize-y border border-line bg-panel-2 p-3 font-mono text-xs leading-relaxed outline-none placeholder:text-mute/50 focus:border-accent/60 disabled:opacity-50"
      />
      <div className="mt-2 flex items-center gap-2">
        <p className="mr-auto text-[11px] text-mute">{hint}</p>
        <Button type="submit" size="sm" variant="primary" disabled={disabled || !text.trim()}>
          일괄 추가
        </Button>
      </div>
    </form>
  );
}
