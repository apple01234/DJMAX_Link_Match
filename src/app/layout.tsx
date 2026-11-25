import type { Metadata, Viewport } from "next";
import "./globals.css";
import Link from "next/link";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: { default: "DJMAX LINK MATCH 2027", template: "%s · LINK MATCH 2027" },
  description: "DJMAX LINK MATCH 2027 대회 정보와 실시간 팀 드래프트",
};

export const viewport: Viewport = {
  themeColor: "#0b0d11",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800;900&family=IBM+Plex+Mono:wght@500;600&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-dvh bg-bg font-sans text-ink antialiased">
        <Nav />
        {children}
        <footer className="border-t border-line">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-6">
            <span className="label">DJMAX LINK MATCH 2027</span>
            <span className="label">2027.01.30 – 01.31</span>
            <Link href="/privacy" className="label hover:text-ink">
              운영·개인정보 안내
            </Link>
            {/* 서버 없이 열리는 단일 파일 데모 (public/demo.html) */}
            <a href="/demo.html" className="label hover:text-ink">
              오프라인 데모
            </a>
            <p className="w-full text-xs text-mute sm:ml-auto sm:w-auto">
              스태프 지원용 초안입니다. 일정·규칙·참가자 정보는 예시입니다.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
