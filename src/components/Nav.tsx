"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/client";

const LINKS = [
  { href: "/", label: "홈" },
  { href: "/draft", label: "드래프트" },
  { href: "/teams", label: "참가 팀" },
];

export function Nav() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg">
      <nav aria-label="주 메뉴" className="mx-auto flex h-13 max-w-[1400px] items-stretch px-4">
        <Link
          href="/"
          className="mr-3 flex items-center gap-2 font-display text-xl font-black tracking-tight whitespace-nowrap uppercase sm:mr-6"
        >
          <span aria-hidden className="note" />
          <span>Link Match</span>
          <span className="hidden text-chrome sm:inline">27</span>
        </Link>
        {LINKS.map((l) => {
          const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex items-center px-2.5 text-sm font-semibold whitespace-nowrap transition-colors sm:px-4",
                active ? "bg-panel text-ink" : "text-mute hover:text-ink",
              )}
            >
              {l.label}
              {active && <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-judge" />}
            </Link>
          );
        })}
        <Link
          href="/admin"
          aria-current={path.startsWith("/admin") ? "page" : undefined}
          className={cn(
            "ml-auto flex items-center px-2 font-mono text-[11px] font-semibold tracking-widest whitespace-nowrap uppercase transition-colors",
            path.startsWith("/admin") ? "text-ink" : "text-mute/70 hover:text-ink",
          )}
        >
          Staff
        </Link>
      </nav>
    </header>
  );
}
