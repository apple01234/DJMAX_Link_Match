"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePolledState } from "@/hooks/useDraftState";
import { api, cn, STATUS_LABEL } from "@/lib/client";
import { picksUntilTurn, totalPicks } from "@/lib/draft";
import { MAIN_KEYS, TIERS, type Pick, type Player, type PublicState, type Team, type Tier } from "@/lib/types";
import { Button, Card, TeamDot, TierBadge } from "@/components/ui";
import { PickClock } from "./PickClock";
import { OrderStrip } from "./OrderStrip";

const CODE_KEY = "linkmatch27.captainCode";

interface Captain {
  code: string;
  team: Team;
}

export function DraftRoom() {
  const { state, error, now, accept } = usePolledState<PublicState>("/api/state", 1500);
  const [captain, setCaptain] = useState<Captain | null>(null);
  const [confirm, setConfirm] = useState<Player | null>(null);
  const [toast, setToast] = useState<{ text: string; color: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /* ── 주장 로그인 (코드는 이 브라우저에만 저장) ── */
  const login = useCallback(async (code: string, silent = false) => {
    try {
      const { team } = await api<{ team: Team }>("/api/captain/login", { json: { code } });
      setCaptain({ code, team });
      try {
        localStorage.setItem(CODE_KEY, code);
      } catch {}
      return null;
    } catch (e) {
      if (silent) {
        try {
          localStorage.removeItem(CODE_KEY);
        } catch {}
      }
      return e instanceof Error ? e.message : String(e);
    }
  }, []);

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(CODE_KEY);
    } catch {}
    if (saved) login(saved, true);
  }, [login]);

  const logout = () => {
    setCaptain(null);
    try {
      localStorage.removeItem(CODE_KEY);
    } catch {}
  };

  /* ── 파생 데이터 ── */
  const view = useMemo(() => {
    if (!state) return null;
    const teamById = new Map(state.teams.map((t) => [t.id, t]));
    const playerById = new Map(state.players.map((p) => [p.id, p]));
    const pickByPlayer = new Map<number, Pick>(state.picks.map((p) => [p.playerId, p]));
    return { teamById, playerById, pickByPlayer };
  }, [state]);

  /* ── 모달을 닫으면 포커스를 연 카드로 되돌린다 (키보드 사용자가 위치를 잃지 않게) ── */
  const openerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (confirm || !openerRef.current) return;
    const el = openerRef.current;
    openerRef.current = null;
    requestAnimationFrame(() => {
      if (el.isConnected && !(el as HTMLButtonElement).disabled) el.focus();
      else document.getElementById("pool-search")?.focus();
    });
  }, [confirm]);

  /* ── 새 픽이 들어오면 토스트 ── */
  const lastCount = useRef<number | null>(null);
  useEffect(() => {
    if (!state || !view) return;
    const n = state.picks.length;
    if (lastCount.current !== null && n > lastCount.current) {
      const last = state.picks[n - 1];
      const team = view.teamById.get(last.teamId);
      const player = view.playerById.get(last.playerId);
      if (team && player) {
        setToast({ text: `${team.name} — ${player.nickname} 지명${last.auto ? " (시간 초과 자동)" : ""}`, color: team.color });
        const id = setTimeout(() => setToast(null), 3500);
        lastCount.current = n;
        return () => clearTimeout(id);
      }
    }
    lastCount.current = n;
  }, [state, view]);

  if (!state || !view) {
    return error ? (
      <main className="mx-auto max-w-[1400px] px-4 py-16">
        <Card className="mx-auto max-w-md p-6 text-center">
          <p className="font-bold">드래프트 보드를 불러오지 못했습니다.</p>
          <p className="mt-1 text-sm text-mute">{error}</p>
          <p className="mt-3 text-xs text-mute">네트워크가 돌아오면 자동으로 다시 시도합니다.</p>
        </Card>
      </main>
    ) : (
      <main className="mx-auto max-w-[1400px] px-4 py-6" aria-busy="true" aria-label="드래프트 보드 불러오는 중">
        <div className="skeleton h-36" />
        <div className="skeleton mt-4 h-16" />
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} className="skeleton h-20" />
            ))}
          </div>
          <div className="skeleton h-64" />
        </div>
      </main>
    );
  }

  const { draft, current } = state;
  const total = totalPicks(draft.order.length, draft.rounds);
  const currentTeam = current ? view.teamById.get(current.teamId) : undefined;
  const isMyTurn = !!captain && draft.status === "running" && current?.teamId === captain.team.id;
  const msLeft =
    draft.status === "running" && state.deadline
      ? state.deadline - now
      : draft.status === "paused"
        ? (draft.pausedLeftMs ?? 0)
        : draft.pickSeconds * 1000;
  const until =
    captain && (draft.status === "running" || draft.status === "paused")
      ? picksUntilTurn(draft.order, draft.rounds, state.picks.length, captain.team.id)
      : null;

  // 선수 카드를 누를 수 없는 이유를 상황별로 알려준다
  const poolHint =
    draft.status === "setup"
      ? "드래프트가 시작되면 주장이 자기 차례에 선수를 지명합니다."
      : draft.status === "done"
        ? "드래프트가 끝났습니다. 색 띠는 해당 선수를 지명한 팀입니다."
        : draft.status === "paused"
          ? "일시정지 중에는 지명할 수 없습니다."
          : !captain
            ? "주장이라면 오른쪽(모바일은 아래)에서 주장 코드로 로그인하세요. 관전은 로그인 없이 가능합니다."
            : isMyTurn
              ? "지명할 선수를 누르세요. 확인 창에서 한 번 더 확인합니다."
              : until !== null
                ? `${until}픽 뒤에 ${captain.team.name}의 차례입니다.`
                : "이 팀은 남은 차례가 없습니다.";

  const doPick = async (player: Player) => {
    if (!captain) return;
    setBusy(true);
    setActionError(null);
    try {
      accept(await api<PublicState>("/api/draft/pick", { json: { code: captain.code, playerId: player.id } }));
      setConfirm(null);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6">
      {error && (
        <p role="alert" className="mb-4 border border-gold/40 bg-gold/10 px-4 py-2.5 text-sm text-gold">
          서버 연결이 불안정합니다. 마지막으로 받은 화면을 보여주고 있으며 자동으로 다시 연결합니다.
        </p>
      )}

      {/* 상단: 현재 차례 + 타이머 */}
      {/* 스코어보드: 왼쪽은 지명 중인 팀, 오른쪽은 남은 시간. 아래 막대는 남은 시간 비율 */}
      <Card className="relative">
        <div className="flex items-center gap-3 border-b border-line px-5 py-3">
          <StatusPill status={draft.status} />
          {current && (
            <span className="label tabular">
              Round {current.round + 1}/{draft.rounds} · Pick {String(current.pickNo + 1).padStart(2, "0")}/{total}
            </span>
          )}
          {isMyTurn && (
            <span role="status" className="animate-pop ml-auto bg-ok px-2 py-0.5 text-xs font-bold text-bg">
              내 차례
            </span>
          )}
        </div>
        <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1" aria-live="polite">
            <p className="label">
              {draft.status === "running" || draft.status === "paused" ? "On the clock" : draft.status === "done" ? "Final" : "Standby"}
            </p>
            <h1 className="mt-2 flex items-stretch gap-3 text-3xl leading-tight font-black tracking-tight sm:text-5xl">
              {currentTeam && (draft.status === "running" || draft.status === "paused") ? (
                <>
                  <span aria-hidden className="w-1.5 shrink-0" style={{ background: currentTeam.color }} />
                  <span className="min-w-0">{currentTeam.name}</span>
                </>
              ) : draft.status === "done" ? (
                "드래프트 완료"
              ) : (
                "드래프트 시작 전"
              )}
            </h1>
            <p className="mt-2 text-sm text-mute">
              {draft.status === "setup" && "운영진이 드래프트를 시작하면 이 화면이 자동으로 바뀝니다."}
              {draft.status === "done" && "모든 픽이 끝났습니다. 참가 팀 페이지에서 확정 로스터를 확인하세요."}
              {draft.status === "paused" && "운영진이 드래프트를 일시정지했습니다. 남은 시간은 그대로 유지됩니다."}
              {draft.status === "running" &&
                currentTeam &&
                `주장 ${currentTeam.captain} · 시간이 지나면 레이팅이 가장 높은 선수가 자동 지명됩니다.`}
            </p>
          </div>
          <PickClock msLeft={msLeft} active={draft.status === "running"} paused={draft.status === "paused"} />
        </div>
        {(draft.status === "running" || draft.status === "paused") && (
          <div aria-hidden className="h-1 bg-line">
            <div
              className="h-full transition-[width] duration-200 ease-linear"
              style={{
                width: `${Math.max(0, Math.min(100, (msLeft / (draft.pickSeconds * 1000)) * 100))}%`,
                background: msLeft <= 10_000 && draft.status === "running" ? "var(--color-live)" : (currentTeam?.color ?? "var(--color-judge)"),
              }}
            />
          </div>
        )}
      </Card>

      <OrderStrip state={state} teamById={view.teamById} playerById={view.playerById} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <PlayerPool
          players={state.players}
          pickByPlayer={view.pickByPlayer}
          teamById={view.teamById}
          canPick={isMyTurn}
          hint={poolHint}
          onPick={(p) => {
            openerRef.current = document.activeElement as HTMLElement | null;
            setActionError(null);
            setConfirm(p);
          }}
        />
        <aside className="space-y-6">
          <CaptainPanel captain={captain} until={until} onLogin={login} onLogout={logout} />
          <Rosters state={state} teamById={view.teamById} playerById={view.playerById} />
        </aside>
      </div>

      {toast && (
        <div
          role="status"
          className="animate-drop fixed top-[4.5rem] left-1/2 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-2 border border-line bg-panel-2 px-4 py-2.5 text-sm font-bold shadow-lg shadow-black/50"
        >
          <TeamDot color={toast.color} />
          <span className="min-w-0">{toast.text}</span>
        </div>
      )}

      {confirm && (
        <ConfirmModal
          player={confirm}
          team={captain?.team}
          busy={busy}
          error={actionError}
          onCancel={() => setConfirm(null)}
          onConfirm={() => doPick(confirm)}
        />
      )}
    </main>
  );
}

/* ───────────────────────── sub components ───────────────────────── */

function StatusPill({ status }: { status: PublicState["draft"]["status"] }) {
  const style = {
    setup: "bg-white/8 text-mute",
    running: "bg-live text-white",
    paused: "bg-gold text-bg",
    done: "bg-ok text-bg",
  }[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-1.5 py-0.5 font-mono text-[11px] font-semibold", style)}>
      {status === "running" && <span className="size-1.5 animate-pulse bg-white" />}
      {status === "running" ? "LIVE" : STATUS_LABEL[status]}
    </span>
  );
}

function PlayerPool({
  players,
  pickByPlayer,
  teamById,
  canPick,
  hint,
  onPick,
}: {
  players: Player[];
  pickByPlayer: Map<number, Pick>;
  teamById: Map<number, Team>;
  canPick: boolean;
  hint: string;
  onPick: (p: Player) => void;
}) {
  const [q, setQ] = useState("");
  const [tier, setTier] = useState<Tier | "all">("all");
  const [key, setKey] = useState<string>("all");
  const [hideTaken, setHideTaken] = useState(false);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return players.filter(
      (p) =>
        (!needle || p.nickname.toLowerCase().includes(needle)) &&
        (tier === "all" || p.tier === tier) &&
        (key === "all" || p.mainKey === key) &&
        (!hideTaken || !pickByPlayer.has(p.id)),
    );
  }, [players, q, tier, key, hideTaken, pickByPlayer]);

  const available = players.length - pickByPlayer.size;
  const filtered = q || tier !== "all" || key !== "all" || hideTaken;

  return (
    <section aria-labelledby="pool-title">
      <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="pool-title" className="text-lg font-black">
          선수 풀
        </h2>
        <span className="tabular text-sm text-mute">
          남은 선수 {available}명 / 전체 {players.length}명
        </span>
      </div>
      <p className={cn("mb-3 text-sm", canPick ? "font-semibold text-ok" : "text-mute")}>{hint}</p>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label htmlFor="pool-search" className="sr-only">
          닉네임 검색
        </label>
        <input
          id="pool-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="닉네임 검색"
          className="h-9 w-full border border-line bg-panel px-3 text-sm outline-none placeholder:text-mute/60 focus:border-judge sm:w-44"
        />
        <Segmented
          label="티어"
          value={tier}
          onChange={(v) => setTier(v as Tier | "all")}
          options={["all", ...TIERS]}
          render={(v) => (v === "all" ? "전체 티어" : v)}
        />
        <Segmented
          label="주력 키"
          value={key}
          onChange={setKey}
          options={["all", ...MAIN_KEYS]}
          render={(v) => (v === "all" ? "전체 키" : v)}
        />
        <label className="flex min-h-9 cursor-pointer items-center gap-1.5 text-xs text-mute select-none">
          <input
            type="checkbox"
            checked={hideTaken}
            onChange={(e) => setHideTaken(e.target.checked)}
            className="size-4 accent-accent"
          />
          지명된 선수 숨기기
        </label>
      </div>

      {list.length === 0 ? (
        <Card className="p-8 text-center text-sm text-mute">
          {players.length === 0 ? (
            "아직 등록된 선수가 없습니다. 운영진이 선수를 등록하면 여기에 표시됩니다."
          ) : (
            <>
              조건에 맞는 선수가 없습니다.
              {filtered && (
                <button
                  type="button"
                  className="ml-2 cursor-pointer font-semibold text-accent underline-offset-4 hover:underline"
                  onClick={() => {
                    setQ("");
                    setTier("all");
                    setKey("all");
                    setHideTaken(false);
                  }}
                >
                  필터 초기화
                </button>
              )}
            </>
          )}
        </Card>
      ) : (
        /* 곡 선택 화면처럼: 한 줄에 한 선수, 왼쪽 티어 칸 · 가운데 이름 · 오른쪽 레이팅 */
        <div className="bg-panel">
          <div
            aria-hidden
            className="label hidden grid-cols-[2.25rem_minmax(0,1fr)_3.5rem_5.5rem_9rem] gap-x-3 border-b border-line px-3 py-2 sm:grid"
          >
            <span>Tier</span>
            <span>Player</span>
            <span>Key</span>
            <span className="text-right">Rating</span>
            <span>Team</span>
          </div>
          <ul>
            {list.map((p) => {
              const pick = pickByPlayer.get(p.id);
              const team = pick && teamById.get(pick.teamId);
              const selectable = canPick && !pick;
              return (
                <li key={p.id} className="border-b border-line/70 last:border-b-0">
                  <button
                    type="button"
                    disabled={!selectable}
                    aria-label={`${p.nickname}, ${p.tier} 티어, 레이팅 ${p.rating}, ${p.mainKey}${team ? `, ${team.name} 지명` : ""}`}
                    onClick={() => onPick(p)}
                    className={cn(
                      "group relative grid w-full grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-x-3 px-3 py-2.5 text-left",
                      "sm:grid-cols-[2.25rem_minmax(0,1fr)_3.5rem_5.5rem_9rem]",
                      "transition-colors duration-100",
                      selectable ? "cursor-pointer hover:bg-accent/15 active:bg-accent/25" : "cursor-default",
                    )}
                  >
                    {/* 선택 가능한 줄은 호버 시 왼쪽에 블루 노트 바 */}
                    {selectable && (
                      <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-accent opacity-0 transition-opacity group-hover:opacity-100" />
                    )}
                    {team && <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: team.color }} />}
                    <span className={cn(pick && "opacity-40")}>
                      <TierBadge tier={p.tier} />
                    </span>
                    <span className={cn("min-w-0", pick && "opacity-40")}>
                      <span className="block leading-snug font-bold">{p.nickname}</span>
                      {p.note && <span className="block text-xs text-mute">{p.note}</span>}
                      {/* 모바일: 키와 팀을 이름 아래에 */}
                      <span className="mt-0.5 flex flex-wrap gap-x-2 font-mono text-[11px] text-mute sm:hidden">
                        <span>{p.mainKey}</span>
                        {team && <span style={{ color: team.color }}>{team.name}</span>}
                      </span>
                    </span>
                    <span className={cn("hidden font-mono text-xs text-mute sm:block", pick && "opacity-40")}>{p.mainKey}</span>
                    <span className={cn("score text-right text-2xl", pick && "opacity-40")}>{p.rating.toLocaleString()}</span>
                    <span className="hidden min-w-0 text-xs font-semibold sm:block" style={team ? { color: team.color } : undefined}>
                      {team ? team.name : selectable ? <span className="font-mono text-accent">PICK →</span> : ""}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

function Segmented({
  label,
  value,
  onChange,
  options,
  render,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  render: (v: string) => string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex min-h-9 items-center border border-line bg-panel p-0.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={value === o}
          onClick={() => onChange(o)}
          className={cn(
            "press h-8 cursor-pointer px-2.5 font-mono text-xs font-semibold whitespace-nowrap",
            value === o ? "bg-chrome text-bg" : "text-mute hover:text-ink",
          )}
        >
          {render(o)}
        </button>
      ))}
    </div>
  );
}

function CaptainPanel({
  captain,
  until,
  onLogin,
  onLogout,
}: {
  captain: Captain | null;
  until: number | null;
  onLogin: (code: string) => Promise<string | null>;
  onLogout: () => void;
}) {
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!captain) {
    return (
      <Card className="p-5">
        <h2 className="font-black">주장 로그인</h2>
        <p className="mt-1 text-xs leading-relaxed text-mute">
          운영진에게 받은 6자리 주장 코드를 입력하세요. 코드는 이 브라우저에만 저장됩니다.
        </p>
        <form
          className="mt-3 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setErr(await onLogin(code.trim().toUpperCase()));
            setBusy(false);
          }}
        >
          <label htmlFor="captain-code" className="sr-only">
            주장 코드
          </label>
          <input
            id="captain-code"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""));
              setErr(null);
            }}
            placeholder="ABC234"
            maxLength={6}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-invalid={!!err}
            aria-describedby={err ? "captain-code-error" : undefined}
            className={cn(
              "tabular h-10 min-w-0 flex-1 border bg-panel-2 px-3 font-mono tracking-[0.3em] uppercase outline-none placeholder:tracking-[0.3em] placeholder:text-mute/40 focus:border-accent",
              err ? "border-danger" : "border-line",
            )}
          />
          <Button variant="primary" type="submit" disabled={busy || code.length < 6}>
            {busy ? "확인 중…" : "로그인"}
          </Button>
        </form>
        {err && (
          <p id="captain-code-error" role="alert" className="mt-2 text-xs text-danger">
            {err}
          </p>
        )}
      </Card>
    );
  }

  return (
    <Card className="relative p-5 pl-6">
      <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: captain.team.color }} />
      <div className="flex items-start gap-2">
        <TeamDot color={captain.team.color} className="mt-1.5" />
        <div className="min-w-0 flex-1">
          <h2 className="leading-snug font-black">{captain.team.name}</h2>
          <p className="text-xs text-mute">주장 {captain.team.captain}으로 로그인됨</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onLogout}>
          로그아웃
        </Button>
      </div>
      <p className="mt-3 text-sm">
        {until === 0 && <span className="font-bold text-ok">지금 내 차례입니다.</span>}
        {until !== null && until > 0 && (
          <span className="text-mute">
            내 차례까지 <b className="tabular text-ink">{until}</b>픽 남았습니다.
          </span>
        )}
        {until === null && <span className="text-mute">진행 중인 드래프트에서 남은 차례가 없습니다.</span>}
      </p>
    </Card>
  );
}

function Rosters({
  state,
  teamById,
  playerById,
}: {
  state: PublicState;
  teamById: Map<number, Team>;
  playerById: Map<number, Player>;
}) {
  const currentTeamId = state.draft.status === "running" ? state.current?.teamId : undefined;
  if (state.draft.order.length === 0) {
    return (
      <section>
        <h2 className="mb-3 text-lg font-black">팀 로스터</h2>
        <Card className="p-6 text-center text-sm text-mute">아직 등록된 팀이 없습니다.</Card>
      </section>
    );
  }
  return (
    <section>
      <h2 className="mb-3 text-lg font-black">팀 로스터</h2>
      <div className="space-y-2">
        {state.draft.order.map((id) => {
          const t = teamById.get(id);
          if (!t) return null;
          const roster = state.picks.filter((p) => p.teamId === id);
          const onClock = currentTeamId === id;
          return (
            <Card key={id} className={cn("relative p-3.5 pl-5", onClock && "bg-panel-2")}>
              <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: t.color }} />
              <div className="flex items-start gap-2 text-sm">
                <TeamDot color={t.color} className="mt-1.5" />
                <span className="min-w-0 flex-1 leading-snug font-bold">{t.name}</span>
                {onClock && <span className="text-xs font-bold" style={{ color: t.color }}>지명 중</span>}
                <span className="tabular text-xs text-mute">
                  {roster.length}/{state.draft.rounds}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="bg-white/10 px-2 py-0.5 text-xs font-semibold">주장 {t.captain}</span>
                {roster.map((pk) => {
                  const p = playerById.get(pk.playerId);
                  return (
                    <span key={pk.pickNo} className="border border-line px-2 py-0.5 text-xs">
                      {p?.nickname}
                      {pk.auto && <span className="ml-1 text-mute">· 자동</span>}
                    </span>
                  );
                })}
                {Array.from({ length: Math.max(0, state.draft.rounds - roster.length) }, (_, i) => (
                  <span key={`e${i}`} className="border border-dashed border-line px-2 py-0.5 text-xs text-mute/60">
                    빈 자리
                  </span>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function ConfirmModal({
  player,
  team,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  player: Player;
  team?: Team;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
      if (e.key === "Tab" && dialogRef.current) {
        // 포커스가 모달 밖으로 나가지 않게
        const items = dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled])");
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, busy]);

  return (
    <div className="animate-fade fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={() => !busy && onCancel()}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-desc"
        className="cut animate-pop w-full max-w-sm bg-panel p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs font-bold text-mute">지명 확인</p>
        <h3 id="confirm-title" className="mt-2 flex items-start gap-2 text-2xl leading-tight font-black">
          <TierBadge tier={player.tier} />
          <span className="min-w-0">{player.nickname}</span>
        </h3>
        <p className="tabular mt-1 text-sm text-mute">
          레이팅 {player.rating.toLocaleString()} · {player.mainKey}
        </p>
        <p id="confirm-desc" className="mt-4 text-sm">
          {team ? (
            <>
              <b style={{ color: team.color }}>{team.name}</b> 팀으로 지명합니다. 지명 후에는 운영진만 되돌릴 수 있습니다.
            </>
          ) : (
            "주장으로 로그인해야 지명할 수 있습니다."
          )}
        </p>
        {error && (
          <p role="alert" className="mt-3 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            취소
          </Button>
          <Button variant="primary" onClick={onConfirm} disabled={busy || !team} autoFocus>
            {busy ? "지명 중…" : "지명하기"}
          </Button>
        </div>
      </div>
    </div>
  );
}
