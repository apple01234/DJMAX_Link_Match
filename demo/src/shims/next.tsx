/** next/link · next/navigation 대체: 해시 라우팅(#/draft)으로 단일 파일에서도 페이지를 오간다. */
import { useSyncExternalStore, type AnchorHTMLAttributes } from "react";

const readPath = () => (location.hash.replace(/^#/, "") || "/").split("?")[0];

function subscribe(fn: () => void) {
  window.addEventListener("hashchange", fn);
  return () => window.removeEventListener("hashchange", fn);
}

export function usePathname(): string {
  return useSyncExternalStore(subscribe, readPath, () => "/");
}

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

export default function Link({ href, onClick, ...rest }: LinkProps) {
  const internal = href.startsWith("/");
  return (
    <a
      {...rest}
      href={internal ? `#${href}` : href}
      onClick={(e) => {
        onClick?.(e);
        if (internal) window.scrollTo(0, 0);
      }}
    />
  );
}
