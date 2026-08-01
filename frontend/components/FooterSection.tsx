"use client";

import { useEffect, useRef } from "react";

/**
 * Footer section that collapses on phones and stays open on desktop.
 *
 * The footer carries ~48 links across 7 sections. On desktop that is a normal
 * directory footer; on a phone, where the grid is 2 columns, it stacks to
 * roughly 33 rows of links between the end of the content and the end of the
 * page.
 *
 * Uses <details> rather than hiding overflow links with `display: none`. These
 * links exist for internal linking — /decadas had no inbound links at all
 * before they were added — and Google indexes mobile-first, so hiding them on
 * mobile would discard the reason they are here. Accordion content stays in
 * the DOM and is indexed normally.
 *
 * Renders `open` on the server, so no-JS clients and any crawler that skips
 * scripts get the fully expanded footer. The effect closes it only on small
 * viewports after mount.
 */
export default function FooterSection({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => {
      if (ref.current) ref.current.open = mq.matches;
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return (
    <details ref={ref} open className="[&>summary::-webkit-details-marker]:hidden">
      <summary
        className="flex items-center justify-between gap-2 list-none cursor-pointer md:cursor-default md:pointer-events-none py-1 md:py-0 -my-1 md:my-0"
      >
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-dust mb-3">
          {heading}
        </span>
        {/* Affordance only matters while the section can actually collapse. */}
        <svg
          className="w-3.5 h-3.5 text-dust shrink-0 mb-3 transition-transform md:hidden [details[open]_&]:rotate-180"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      {children}
    </details>
  );
}
