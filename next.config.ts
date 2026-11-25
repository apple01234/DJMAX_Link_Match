import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // 다른 사이트가 드래프트·관리자 화면을 iframe으로 감싸 클릭을 유도하지 못하게
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // 서버 없이 도는 단일 파일 데모(demo/ 에서 빌드해 public/demo.html 로 복사)를 짧은 주소로
  async rewrites() {
    return [{ source: "/demo", destination: "/demo.html" }];
  },
};

export default nextConfig;
