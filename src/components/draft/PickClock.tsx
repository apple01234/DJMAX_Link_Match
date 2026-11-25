import { cn, formatClock } from "@/lib/client";

/** 점수판 숫자 타이머. 10초 이하면 레드로 깜빡인다. 진행 막대는 스코어보드 하단에 따로 그린다. */
export function PickClock({ msLeft, active, paused }: { msLeft: number; active: boolean; paused: boolean }) {
  const urgent = active && msLeft <= 10_000;
  return (
    <div className="shrink-0 sm:text-right">
      <p className="label">{paused ? "Paused" : "Time left"}</p>
      <p
        aria-label={`남은 시간 ${formatClock(msLeft)}`}
        className={cn(
          "score mt-1 text-7xl sm:text-8xl",
          urgent && "animate-urgent text-live",
          !active && !paused && "text-mute/50",
          paused && "text-gold",
        )}
      >
        {active || paused ? formatClock(msLeft) : "--:--"}
      </p>
    </div>
  );
}
