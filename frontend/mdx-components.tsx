import type { MDXComponents } from "mdx/types";
import Link from "next/link";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    // Article container — wraps every MDX page automatically
    wrapper: ({ children }) => (
      <main id="main-content" className="max-w-3xl mx-auto px-4 py-8">
        {children}
      </main>
    ),

    h1: ({ children }) => (
      <h1 className="font-display text-3xl sm:text-4xl font-black text-cream leading-tight mb-4">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="font-display text-xl font-bold text-cream mt-10 mb-3 pb-2 border-b border-groove">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="font-display text-lg font-bold text-cream mt-6 mb-2">
        {children}
      </h3>
    ),
    p: ({ children }) => (
      <p className="text-parchment text-sm leading-relaxed mb-4">{children}</p>
    ),
    a: ({ href, children }) => {
      const isInternal = href?.startsWith("/");
      if (isInternal && href) {
        return (
          <Link
            href={href}
            className="text-gold hover:text-goldlit underline underline-offset-2 transition-colors"
          >
            {children}
          </Link>
        );
      }
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-gold hover:text-goldlit underline underline-offset-2 transition-colors"
        >
          {children}
        </a>
      );
    },
    ul: ({ children }) => (
      <ul className="text-parchment text-sm leading-relaxed mb-4 space-y-1.5 list-none pl-0">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="text-parchment text-sm leading-relaxed mb-4 space-y-1.5 list-decimal pl-5">
        {children}
      </ol>
    ),
    li: ({ children }) => (
      <li className="flex gap-2 items-start before:content-['—'] before:text-gold before:shrink-0 before:mt-0.5">
        <span>{children}</span>
      </li>
    ),
    strong: ({ children }) => (
      <strong className="text-cream font-semibold">{children}</strong>
    ),
    em: ({ children }) => (
      <em className="text-parchment italic">{children}</em>
    ),
    blockquote: ({ children }) => (
      <blockquote className="border-l-2 border-gold pl-4 my-6 text-parchment italic text-sm leading-relaxed">
        {children}
      </blockquote>
    ),
    code: ({ children }) => (
      <code className="bg-label border border-groove rounded px-1.5 py-0.5 text-xs text-parchment font-mono">
        {children}
      </code>
    ),
    pre: ({ children }) => (
      <pre className="bg-label border border-groove rounded-xl p-4 overflow-x-auto text-xs text-parchment font-mono mb-4">
        {children}
      </pre>
    ),
    hr: () => <hr className="border-groove my-8" />,
    table: ({ children }) => (
      <div className="overflow-x-auto rounded-xl border border-groove mb-6">
        <table className="w-full text-sm">{children}</table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="border-b border-groove">{children}</thead>
    ),
    th: ({ children }) => (
      <th className="text-left px-4 py-3 text-dust font-semibold">{children}</th>
    ),
    td: ({ children }) => (
      <td className="px-4 py-3 text-parchment border-b border-groove last:border-0">
        {children}
      </td>
    ),
    tr: ({ children }) => (
      <tr className="hover:bg-sleeve transition-colors">{children}</tr>
    ),

    ...components,
  };
}
