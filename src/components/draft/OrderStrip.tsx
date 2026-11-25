"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/client";
import { slotAt, totalPicks } from "@/lib/draft";
import type { Player, PublicState, Team } from "@/lib/types";

/** 전체 픽 순서를 가로 스트립으로 보여주고 현재 픽을 가운데로 스크롤한다. */
export function OrderStrip({
  state,
  teamById,
  playerById,
}: {
  state: PublicState;
  teamById: Map<number, Team>;
  playerById: Map<number, Player>;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const { order, rounds } = state.draft;
  const total = totalPicks(order.length, rounds);
  const currentNo = state.current?.pickNo ?? (state.draft.status === "done" ? total - 1 : 0);

  useEffect(() => {
    const el = scroller.current?.querySelector<HTMLElement>(`[data-pick="${currentNo}"]`);
    const box = scroller.current;
    if (!el || !box) return;
    box.scrollTo({ left: el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2, behavior: "smooth" });
  }, [currentNo]);

  if (total === 0) return null;

  return (
    <div
      ref={scroller}
      className="scrollbar-thin relative mt-4 flex gap-1.5 overflow-x-auto pb-2"
      aria-label="픽 순서"
    >
      {Array.from({ length: total }, (_, i) => {
        const slot = slotAt(order, rounds, i)!;
        const team = teamById.get(slot.teamId);
        const pick = state.picks[i];
        const player = pick && playerById.get(pick.playerId);
        const isCurrent = state.current?.pickNo === i;
        return (
          <div key={i} className="flex shrink-0 items-stretch gap-1.5" data-pick={i}>
            {slot.indexInRound === 0 && (
              <div className="flex w-9 flex-col items-center justify-center font-mono text-[10px] font-semibold text-mute">
                <span>R{slot.round + 1}</span>
                <span aria-hidden>{slot.round % 2 === 0 ? "→" : "←"}</span>
              </div>
            )}
            <div
              className={cn(
                "relative w-32 px-2.5 pt-2.5 pb-2 transition-colors",
                isCurrent ? "bg-panel-2" : "bg-panel",
                !pick && !isCurrent && "opacity-55",
              )}
            >
              <span aria-hidden className="absolute inset-x-0 top-0 h-0.5" style={{ background: team?.color }} />
              {isCurrent && <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-judge" />}
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="tabular font-mono text-mute">#{String(i + 1).padStart(2, "0")}</span>
                <span className="truncate font-bold" style={{ color: team?.color }} title={team?.name}>
                  {team?.name}
                </span>
              </div>
              <p
                className={cn("mt-0.5 truncate text-sm font-semibold", !player && "text-mute/60")}
                title={player?.nickname}
              >
                {player ? player.nickname : isCurrent ? "지명 중…" : "—"}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
