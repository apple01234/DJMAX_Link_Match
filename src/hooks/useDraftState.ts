"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiIfChanged } from "@/lib/client";

/**
 * 상태 폴링 + 서버 시계 보정.
 * Cloudflare/Vercel 같은 서버리스 환경에서도 그대로 동작하도록 WebSocket 대신 짧은 폴링을 쓴다.
 * (실시간성이 더 필요하면 Durable Objects / SSE로 교체할 수 있게 이 훅 하나로 격리)
 */
export function usePolledState<T extends { serverNow: number }>(
  path: string | null,
  intervalMs = 1500,
  headers?: Record<string, string>,
  initial: T | null = null,
) {
  const [state, setState] = useState<T | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const offset = useRef(0);
  const etag = useRef<string | null>(null);
  const headersKey = JSON.stringify(headers ?? {});

  const accept = useCallback((next: T) => {
    offset.current = next.serverNow - Date.now();
    setState(next);
    setError(null);
  }, []);

  const refresh = useCallback(async () => {
    if (!path) return;
    try {
      // 서버가 304(변경 없음)를 주면 지금 화면을 그대로 둔다
      const r = await apiIfChanged<T>(path, etag.current, JSON.parse(headersKey));
      if (r) {
        etag.current = r.etag;
        accept(r.data);
      } else {
        setError(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [path, headersKey, accept]);

  useEffect(() => {
    if (!path) return;
    etag.current = null; // 경로나 헤더(운영진 토큰)가 바뀌면 처음부터 전체 응답을 받는다
    refresh();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, intervalMs);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [path, intervalMs, refresh]);

  // 카운트다운용 로컬 시계 (서버 시각 기준)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() + offset.current), 200);
    return () => clearInterval(id);
  }, []);

  return { state, error, now, refresh, accept };
}
