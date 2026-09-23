import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function SafeMarkdown({ markdown }: { markdown: string }) {
  return (
    <div className="prose prose-invert max-w-none text-sm leading-7 text-slate-200">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          img: () => null,
          a: ({ href, children }) => {
            const safe = typeof href === 'string' && /^(https?:|mailto:)/i.test(href);
            return safe ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> : <span>{children}</span>;
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
