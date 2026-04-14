"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Wraps the grid and plays a fade-in animation every time it mounts.
 * Combined with a key prop in page.tsx (keyed on sort+filter params),
 * this gives a clear "content updated" signal after each filter/sort change.
 */
export default function GridFadeIn({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.animate([{ opacity: 0.15 }, { opacity: 1 }], {
      duration: 220,
      easing: "ease-out",
      fill: "forwards",
    });
  }, []);

  return <div ref={ref}>{children}</div>;
}
