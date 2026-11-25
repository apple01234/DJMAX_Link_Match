import { cn } from "@/lib/client";
import type { Tier } from "@/lib/types";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md";
};

export function Button({ variant = "outline", size = "md", className, ...props }: ButtonProps) {
  const v = {
    primary: "bg-accent text-white hover:bg-[#5a8fff]",
    outline: "border border-line bg-panel-2 hover:border-chrome/50",
    ghost: "text-mute hover:bg-white/5 hover:text-ink",
    danger: "border border-danger/40 text-danger hover:bg-danger/10",
  }[variant];
  const s = size === "sm" ? "min-h-8 px-2.5 text-xs" : "min-h-10 px-4 text-sm";
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "press inline-flex cursor-pointer items-center justify-center gap-2 font-semibold",
        "disabled:pointer-events-none disabled:opacity-40",
        v,
        s,
        className,
      )}
    />
  );
}

/** HUD 패널: 모서리를 깎은 판. 테두리 대신 바탕 명도 차로 구분한다. */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn("cut bg-panel", className)} />;
}

/** 티어 = 난이도 상자처럼: 고정폭, 각진 칸 */
const TIER_STYLE: Record<Tier, string> = {
  S: "bg-gold text-bg",
  A: "bg-chrome text-bg",
  B: "bg-white/10 text-ink",
  C: "bg-white/5 text-mute",
};

export function TierBadge({ tier }: { tier: Tier }) {
  return (
    <span
      aria-label={`${tier} 티어`}
      className={cn(
        "inline-flex h-6 w-6 shrink-0 items-center justify-center font-mono text-xs font-semibold",
        TIER_STYLE[tier],
      )}
    >
      {tier}
    </span>
  );
}

/** 팀 표시: 점 대신 짧은 세로 바(레인 색처럼) */
export function TeamDot({ color, className }: { color: string; className?: string }) {
  return <span aria-hidden className={cn("inline-block h-3.5 w-1 shrink-0", className)} style={{ background: color }} />;
}

export function SectionTitle({ title, desc, aside }: { title: string; desc?: string; aside?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end gap-x-6 gap-y-2">
      <div className="min-w-0">
        <span aria-hidden className="note mb-3 block" />
        <h2 className="text-2xl font-black tracking-tight sm:text-3xl">{title}</h2>
        {desc && <p className="mt-1.5 max-w-2xl text-sm text-mute">{desc}</p>}
      </div>
      {aside && <div className="ml-auto">{aside}</div>}
    </div>
  );
}
