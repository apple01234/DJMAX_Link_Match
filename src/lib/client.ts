/** 브라우저용 fetch 헬퍼: 서버의 { error } 메시지를 그대로 Error로 던진다. */
export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json: body, headers, ...rest } = init;
  const res = await fetch(path, {
    ...rest,
    method: rest.method ?? (body !== undefined ? "POST" : "GET"),
    headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? `요청 실패 (${res.status})`);
  return data as T;
}

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export function formatClock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export const STATUS_LABEL = {
  setup: "준비 중",
  running: "진행 중",
  paused: "일시정지",
  done: "완료",
} as const;
