"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders the assistant's markdown as clean, structured text (bold, lists,
 * tables) instead of showing raw `**` / `-` / `|` syntax. Tailwind-styled to
 * sit nicely inside a chat bubble.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="text-sm leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: (props) => <p className="my-2" {...props} />,
          strong: (props) => <strong className="font-semibold text-foreground" {...props} />,
          em: (props) => <em className="italic" {...props} />,
          ul: (props) => <ul className="my-2 list-disc space-y-1 pl-5" {...props} />,
          ol: (props) => <ol className="my-2 list-decimal space-y-1 pl-5" {...props} />,
          li: (props) => <li className="pl-0.5" {...props} />,
          h1: (props) => <h3 className="mb-1 mt-3 text-base font-semibold" {...props} />,
          h2: (props) => <h3 className="mb-1 mt-3 text-base font-semibold" {...props} />,
          h3: (props) => <h4 className="mb-1 mt-2 text-sm font-semibold" {...props} />,
          a: (props) => (
            <a className="font-medium text-primary underline underline-offset-2" {...props} />
          ),
          hr: () => <hr className="my-3 border-border" />,
          blockquote: (props) => (
            <blockquote
              className="my-2 border-l-2 border-border pl-3 text-muted-foreground"
              {...props}
            />
          ),
          code: (props) => (
            <code
              className="rounded bg-background/60 px-1 py-0.5 font-mono text-[0.8em]"
              {...props}
            />
          ),
          table: (props) => (
            <div className="my-2 overflow-x-auto">
              <table className="w-full border-collapse text-xs" {...props} />
            </div>
          ),
          thead: (props) => <thead className="border-b border-border" {...props} />,
          th: (props) => <th className="px-2 py-1 text-left font-semibold" {...props} />,
          td: (props) => <td className="border-b border-border/50 px-2 py-1" {...props} />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
