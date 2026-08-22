import type { ReactNode } from 'react';

interface AssistantMarkdownProps {
  content: string;
}

type InlineMatchKind = 'link' | 'code' | 'strong' | 'emphasis';

interface InlineMatch {
  kind: InlineMatchKind;
  match: RegExpExecArray;
}

const INLINE_PATTERNS: Array<{ kind: InlineMatchKind; pattern: RegExp }> = [
  { kind: 'link', pattern: /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/u },
  { kind: 'code', pattern: /`([^`\n]+)`/u },
  { kind: 'strong', pattern: /\*\*([^*\n]+)\*\*/u },
  { kind: 'strong', pattern: /__([^_\n]+)__/u },
  { kind: 'emphasis', pattern: /(?<!\*)\*([^*\n]+)\*(?!\*)/u },
  { kind: 'emphasis', pattern: /(?<!_)_([^_\n]+)_(?!_)/u },
];

export default function AssistantMarkdown({ content }: AssistantMarkdownProps) {
  const normalizedContent = content.replace(/\r\n?/gu, '\n');

  return (
    <div className="space-y-2 break-words">
      {renderBlocks(normalizedContent.split('\n'))}
    </div>
  );
}

function renderBlocks(lines: string[], keyPrefix = 'block'): ReactNode[] {
  const blocks: ReactNode[] = [];
  let lineIndex = 0;

  while (lineIndex < lines.length) {
    const line = lines[lineIndex];

    if (!line.trim()) {
      lineIndex += 1;
      continue;
    }

    const fenceMatch = line.match(/^\s*```([\w-]*)\s*$/u);
    if (fenceMatch) {
      const codeLines: string[] = [];
      let closingIndex = lineIndex + 1;
      while (
        closingIndex < lines.length &&
        !/^\s*```\s*$/u.test(lines[closingIndex])
      ) {
        codeLines.push(lines[closingIndex]);
        closingIndex += 1;
      }

      blocks.push(
        <pre
          key={`${keyPrefix}-code-${lineIndex}`}
          className="overflow-x-auto rounded-lg border border-slate-700 bg-slate-950/80 p-3 text-xs leading-5 text-cyan-100"
        >
          <code className={fenceMatch[1] ? `language-${fenceMatch[1]}` : undefined}>
            {codeLines.join('\n')}
          </code>
        </pre>,
      );
      lineIndex = closingIndex < lines.length ? closingIndex + 1 : closingIndex;
      continue;
    }

    const headingMatch = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/u);
    if (headingMatch) {
      blocks.push(
        renderHeading(
          headingMatch[1].length,
          headingMatch[2],
          `${keyPrefix}-heading-${lineIndex}`,
        ),
      );
      lineIndex += 1;
      continue;
    }

    const unorderedItem = line.match(/^\s{0,3}[-*+]\s+(.+)$/u);
    if (unorderedItem) {
      const items: string[] = [];
      const listStart = lineIndex;
      while (lineIndex < lines.length) {
        const itemMatch = lines[lineIndex].match(/^\s{0,3}[-*+]\s+(.+)$/u);
        if (!itemMatch) break;
        items.push(itemMatch[1]);
        lineIndex += 1;
      }
      blocks.push(
        <ul
          key={`${keyPrefix}-unordered-${listStart}`}
          className="list-disc space-y-1 pl-5"
        >
          {items.map((item, itemIndex) => (
            <li key={`${keyPrefix}-unordered-${listStart}-${itemIndex}`}>
              {renderInline(item, `${keyPrefix}-unordered-${listStart}-${itemIndex}`)}
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    const orderedItem = line.match(/^\s{0,3}\d+[.)]\s+(.+)$/u);
    if (orderedItem) {
      const items: string[] = [];
      const listStart = lineIndex;
      while (lineIndex < lines.length) {
        const itemMatch = lines[lineIndex].match(/^\s{0,3}\d+[.)]\s+(.+)$/u);
        if (!itemMatch) break;
        items.push(itemMatch[1]);
        lineIndex += 1;
      }
      blocks.push(
        <ol
          key={`${keyPrefix}-ordered-${listStart}`}
          className="list-decimal space-y-1 pl-5"
        >
          {items.map((item, itemIndex) => (
            <li key={`${keyPrefix}-ordered-${listStart}-${itemIndex}`}>
              {renderInline(item, `${keyPrefix}-ordered-${listStart}-${itemIndex}`)}
            </li>
          ))}
        </ol>,
      );
      continue;
    }

    if (/^\s*>\s?/u.test(line)) {
      const quoteLines: string[] = [];
      const quoteStart = lineIndex;
      while (lineIndex < lines.length) {
        const quoteMatch = lines[lineIndex].match(/^\s*>\s?(.*)$/u);
        if (!quoteMatch) break;
        quoteLines.push(quoteMatch[1]);
        lineIndex += 1;
      }
      blocks.push(
        <blockquote
          key={`${keyPrefix}-quote-${quoteStart}`}
          className="border-l-2 border-cyan-400/60 pl-3 text-slate-400"
        >
          {renderBlocks(quoteLines, `${keyPrefix}-quote-${quoteStart}`)}
        </blockquote>,
      );
      continue;
    }

    const paragraphStart = lineIndex;
    const paragraphLines = [line];
    lineIndex += 1;
    while (
      lineIndex < lines.length &&
      lines[lineIndex].trim() &&
      !isBlockStart(lines[lineIndex])
    ) {
      paragraphLines.push(lines[lineIndex]);
      lineIndex += 1;
    }
    blocks.push(
      <p key={`${keyPrefix}-paragraph-${paragraphStart}`} className="whitespace-pre-wrap">
        {renderInline(paragraphLines.join('\n'), `${keyPrefix}-paragraph-${paragraphStart}`)}
      </p>,
    );
  }

  return blocks;
}

function renderHeading(level: number, content: string, key: string): ReactNode {
  const children = renderInline(content, key);
  const className = 'font-semibold text-cyan-100';
  switch (level) {
    case 1:
      return <h1 className={`text-lg ${className}`} key={key}>{children}</h1>;
    case 2:
      return <h2 className={`text-base ${className}`} key={key}>{children}</h2>;
    case 3:
      return <h3 className={`text-sm ${className}`} key={key}>{children}</h3>;
    case 4:
      return <h4 className={`text-sm ${className}`} key={key}>{children}</h4>;
    case 5:
      return <h5 className={`text-sm ${className}`} key={key}>{children}</h5>;
    default:
      return <h6 className={`text-sm ${className}`} key={key}>{children}</h6>;
  }
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let remaining = text;
  let partIndex = 0;

  while (remaining) {
    const nextMatch = findNextInlineMatch(remaining);
    if (!nextMatch) {
      nodes.push(remaining);
      break;
    }

    if (nextMatch.match.index && nextMatch.match.index > 0) {
      nodes.push(remaining.slice(0, nextMatch.match.index));
    }

    const [fullMatch, firstCapture, secondCapture] = nextMatch.match;
    const key = `${keyPrefix}-inline-${partIndex}`;
    if (nextMatch.kind === 'link') {
      if (isSafeHttpUrl(secondCapture)) {
        nodes.push(
          <a
            key={key}
            href={secondCapture}
            target="_blank"
            rel="noreferrer noopener"
            className="text-cyan-300 underline decoration-cyan-400/50 underline-offset-2 hover:text-cyan-100"
          >
            {renderInline(firstCapture, key)}
          </a>,
        );
      } else {
        nodes.push(firstCapture);
      }
    } else if (nextMatch.kind === 'code') {
      nodes.push(
        <code key={key} className="rounded bg-slate-950/80 px-1.5 py-0.5 text-cyan-200">
          {firstCapture}
        </code>,
      );
    } else if (nextMatch.kind === 'strong') {
      nodes.push(<strong key={key} className="font-semibold text-slate-100">{firstCapture}</strong>);
    } else {
      nodes.push(<em key={key} className="italic text-slate-100">{firstCapture}</em>);
    }

    remaining = remaining.slice((nextMatch.match.index ?? 0) + fullMatch.length);
    partIndex += 1;
  }

  return nodes;
}

function findNextInlineMatch(text: string): InlineMatch | null {
  let earliest: InlineMatch | null = null;
  for (const candidate of INLINE_PATTERNS) {
    const match = candidate.pattern.exec(text);
    if (match && (!earliest || (match.index ?? 0) < (earliest.match.index ?? 0))) {
      earliest = { kind: candidate.kind, match };
    }
  }
  return earliest;
}

function isBlockStart(line: string): boolean {
  return (
    /^\s*```[\w-]*\s*$/u.test(line) ||
    /^\s{0,3}#{1,6}\s+/u.test(line) ||
    /^\s{0,3}[-*+]\s+.+$/u.test(line) ||
    /^\s{0,3}\d+[.)]\s+.+$/u.test(line) ||
    /^\s*>\s?/u.test(line)
  );
}

function isSafeHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
