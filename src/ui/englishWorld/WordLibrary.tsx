import { useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { fetchWordDetail, fetchWords } from '../../api/englishWorldClient';
import { worldKeys } from '../../domains/englishWorld/queryKeys';
import type { Word, WordFilter } from '../../domains/englishWorld/types';
import { Button } from '../Button';
import { Dialog } from '../Dialog';
import { QueryStatus } from '../QueryStatus';
import { playAddress, type WorldPageContext } from './shared';

export function WordLibrary({ context }: { context: WorldPageContext }) {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<WordFilter>('all');
  const [selected, setSelected] = useState<Word | null>(null);
  const words = useInfiniteQuery({ queryKey: worldKeys.words(context.accountId, query, filter), initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => fetchWords({ q: query, filter, cursor: pageParam ?? undefined }, signal), getNextPageParam: page => page.nextCursor ?? undefined, retry: false });
  const entries = [...new Map((words.data?.pages.flatMap(page => page.words) ?? []).map(word => [word.learnerWordId, word])).values()];
  return <div className="mf-content"><div className="mf-page"><section className="ew-intro"><div><p className="mf-eyebrow">YOUR WORDS, IN CONTEXT</p><h2>每个词，都有来处。</h2><p>记录你遇见、查询和主动回忆过的词。遇见不等于掌握；不同词义分别保留经历。</p></div><Button onClick={() => context.navigate('/english-world/review')}>开始复习</Button></section>
    <form className="ew-word-filters" onSubmit={event => { event.preventDefault(); setQuery(search.trim()); }}><label className="mf-field">搜索词库<input type="search" value={search} maxLength={200} onChange={event => setSearch(event.target.value)} placeholder="输入英文单词" /></label><label className="mf-field">筛选<select value={filter} onChange={event => setFilter(event.target.value as WordFilter)}><option value="all">全部遇见</option><option value="lookup">已查词</option><option value="due">待复习</option></select></label><Button type="submit">搜索</Button></form>
    <QueryStatus pending={words.isPending} error={words.error} retry={() => void words.refetch()} />
    {words.data && <p className="mf-muted ew-word-count">共 {words.data.pages[0].total} 个词义记录</p>}
    <div className="ew-world-grid">{entries.map(word => <article className="ew-world-card" key={word.learnerWordId}><div className="ew-card-meta"><span className="ew-tag">{word.meaningStatus === 'unresolved' ? '词义待确定' : word.lookupCount ? '已查询' : '已遇见'}</span><span>遇见 {word.exposureCount} 次</span></div><h3 lang="en">{word.lemma}</h3><p>{word.glossZh ?? (word.meaningStatus === 'unresolved' ? '当前出现的词义尚待确定。' : '这处释义尚未解锁。')}</p>{word.source && <blockquote lang="en">{word.source.textEn}</blockquote>}<Button aria-label={'查看词条 ' + word.lemma} onClick={() => setSelected(word)}>查看词条</Button></article>)}</div>
    {words.data && !entries.length && <div className="ew-empty"><h3>这里还没有词语。</h3><p>在世界里阅读和探索，遇见的词会带着原句来到这里。</p></div>}
    {words.hasNextPage && <div className="mf-load-more"><Button disabled={words.isFetchingNextPage} onClick={() => void words.fetchNextPage()}>读取更多词条</Button></div>}
    {selected && <WordDetailDialog context={context} word={selected} onClose={() => setSelected(null)} />}
  </div></div>;
}
function WordDetailDialog({ context, word, onClose }: { context: WorldPageContext; word: Word; onClose: () => void }) {
  const detail = useQuery({ queryKey: worldKeys.word(context.accountId, word.learnerWordId), queryFn: ({ signal }) => fetchWordDetail(word.learnerWordId, signal), retry: false });
  const current = detail.data?.word;
  return <Dialog title={word.lemma} onClose={onClose}><div className="ew-stack"><QueryStatus pending={detail.isPending} error={detail.error} retry={() => void detail.refetch()} />{current && <><p className="ew-word-meaning">{current.glossZh ?? (current.meaningStatus === 'unresolved' ? '词义尚待确定，暂不安排评分。' : '这处释义尚未解锁。')}</p><p className="mf-muted">遇见 {current.exposureCount} 次 · 查询 {current.lookupCount} 次</p>{current.dueAt && <p>下次复习：{new Date(current.dueAt).toLocaleString('zh-CN')}</p>}{current.source && <div className="ew-context-sentence"><p lang="en">{current.source.textEn}</p><p className="mf-muted">{current.source.speakerName}</p><Button onClick={() => context.navigate(playAddress(current.source!.playthroughId, current.source!.branchId))}>回到故事出处</Button></div>}{!!detail.data?.occurrences.length && <section className="ew-stack"><h3>具体出现记录</h3>{detail.data.occurrences.map(occurrence => <blockquote className="ew-context-sentence" lang="en" key={occurrence.occurrenceId}>{occurrence.textEn}</blockquote>)}</section>}</>}</div></Dialog>;
}
