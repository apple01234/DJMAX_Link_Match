"use client";

import Link from "next/link";
import { usePolledState } from "@/hooks/useDraftState";
import { cn, formatClock } from "@/lib/client";
import { totalPicks } from "@/lib/draft";
import type { PublicState } from "@/lib/types";
import { TeamDot } from "@/components/ui";

/** 홈 상황판: 지금 지명 중인 팀, 남은 시간, 최근 픽. 서버 렌더 값으로 시작해 폴링으로 갱신. */
export function LiveDraft({ initial }: { initial: PublicState }) {
  const { state, now } = usePolledState<PublicState>("/api/state", 2000, undefined, initial);
  const s = state ?? initial;
  const { draft, current } = s;
  const teamById = new Map(s.teams.map((t) => [t.id, t]));
  const playerById = new Map(s.players.map((p) => [p.id, p]));
  const team = current ? teamById.get(current.teamId) : undefined;
  const total = totalPicks(draft.order.length, draft.rounds);
  const msLeft =
    draft.status === "running" && s.deadline ? s.deadline - now : draft.status === "paused" ? (draft.pausedLeftMs ?? 0) : 0;
  const recent = s.picks.slice(-5).reverse();
  const urgent = draft.status === "running" && msLeft <= 10_000;

  return (
    <div className="cut flex h-full flex-col bg-panel">
      {/* 상단 바 */}
      <div className="flex items-center gap-3 border-b border-line px-5 py-3">
        {draft.status === "running" ? (
          <span className="inline-flex items-center gap-1.5 bg-live px-1.5 py-0.5 font-mono text-[11px] font-semibold text-white">
            <span className="size-1.5 animate-pulse bg-white" />
            LIVE
          </span>
        ) : (
          <span className="label">
            {draft.status === "setup" ? "DRAFT · 준비 중" : draft.status === "paused" ? "DRAFT · 일시정지" : "DRAFT · 완료"}
          </span>
        )}
        {current && (
          <span className="label tabular ml-auto">
            R{current.round + 1}/{draft.rounds} · PICK {String(current.pickNo + 1).padStart(2, "0")}/{total}
          </span>
        )}
      </div>

      {/* 본문 */}
      <div className="flex flex-1 flex-col gap-6 px-5 py-5 sm:flex-row">
        <div className="min-w-0 flex-1">
          {(draft.status === "running" || draft.status === "paused") && team ? (
            <>
              <p className="label">On the clock</p>
              <p className="mt-2 flex items-stretch gap-3">
                <span aria-hidden className="w-1.5 shrink-0" style={{ background: team.color }} />
                <span className="min-w-0">
                  <span className="block text-3xl leading-tight font-black sm:text-4xl">{team.name}</span>
                  <span className="mt-1 block text-sm text-mute">주장 {team.captain}</span>
                </span>
              </p>
            </>
          ) : draft.status === "done" ? (
            <>
              <p className="label">Final</p>
              <p className="mt-2 text-3xl font-black">로스터 확정</p>
              <p className="mt-1 text-sm text-mute">{s.teams.length}팀 · {s.picks.length}픽 완료</p>
            </>
          ) : (
            <>
              <p className="label">Next</p>
              <p className="mt-2 text-3xl font-black">팀 드래프트</p>
              <p className="mt-1 text-sm text-mute">
                {s.teams.length ? `${s.teams.length}팀 · 선수 ${s.players.length}명 대기 중` : "참가 팀 등록 전"}
              </p>
            </>
          )}
        </div>

        {(draft.status === "running" || draft.status === "paused") && (
          <div className="sm:text-right">
            <p className="label">{draft.status === "paused" ? "Paused" : "Time left"}</p>
            <p
              className={cn("score mt-1 text-7xl", urgent ? "animate-urgent text-live" : "text-ink")}
              aria-label={`남은 시간 ${formatClock(msLeft)}`}
              suppressHydrationWarning
            >
              {formatClock(msLeft)}
            </p>
          </div>
        )}
      </div>

      {/* 다음 차례 */}
      {current && draft.status !== "done" && (
        <div className="border-t border-line px-5 py-4">
          <p className="label mb-2">Up next</p>
          <ol className="flex flex-wrap gap-x-5 gap-y-1.5">
            {Array.from({ length: 4 }, (_, k) => current.pickNo + 1 + k)
              .filter((n) => n < total)
              .map((n) => {
                const n0 = draft.order.length;
                const round = Math.floor(n / n0);
                const idx = n % n0;
                const t = teamById.get(round % 2 === 0 ? draft.order[idx] : draft.order[n0 - 1 - idx]);
                return (
                  <li key={n} className="flex items-center gap-2 text-sm">
                    <span className="tabular font-mono text-xs text-mute">#{String(n + 1).padStart(2, "0")}</span>
                    {t && <TeamDot color={t.color} />}
                    <span className="font-semibold">{t?.name}</span>
                  </li>
                );
              })}
          </ol>
        </div>
      )}

      {/* 최근 픽 */}
      <div className="border-t border-line px-5 py-4">
        <p className="label mb-2">Recent picks</p>
        {recent.length === 0 ? (
          <p className="text-sm text-mute">아직 지명된 선수가 없습니다.</p>
        ) : (
          <ol className="space-y-1.5">
            {recent.map((pk, i) => {
              const t = teamById.get(pk.teamId);
              const p = playerById.get(pk.playerId);
              return (
                <li key={pk.pickNo} className={cn("flex items-center gap-3 text-sm", i === 0 && "animate-slide")}>
                  <span className="tabular w-8 font-mono text-xs text-mute">#{String(pk.pickNo + 1).padStart(2, "0")}</span>
                  {t && <TeamDot color={t.color} />}
                  <span className="min-w-0 flex-1 font-semibold">{p?.nickname}</span>
                  <span className="min-w-0 text-right text-xs text-mute">
                    {t?.name}
                    {pk.auto && " · 자동"}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <Link
        href={draft.status === "done" ? "/teams" : "/draft"}
        className="press flex min-h-12 items-center justify-between bg-accent px-5 font-bold text-white hover:bg-[#5a8fff]"
      >
        {draft.status === "done" ? "확정 로스터 보기" : "드래프트 보드 열기"}
        <span aria-hidden className="font-mono">→</span>
      </Link>
    </div>
  );
}
