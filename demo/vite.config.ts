import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { fileURLToPath } from "node:url";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// 원본 ../src 를 그대로 쓰고, 서버·Next 의존 부분만 데모용으로 바꿔 끼운다.
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: [
      { find: /^@\/lib\/client$/, replacement: here("./src/mock/client.ts") },
      { find: /^@\/lib\/repo$/, replacement: here("./src/mock/repo.ts") },
      { find: /^next\/(link|navigation)$/, replacement: here("./src/shims/next.tsx") },
      { find: /^@\//, replacement: here("../src/") },
    ],
  },
  server: { fs: { allow: [".."] } },
});
