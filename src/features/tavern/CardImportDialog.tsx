import { useEffect, useRef, useState } from 'react';
import { readCardImport } from './cardImport';
import { importCharacter } from './tavernClient';
import { downloadOfficialCard, fetchOfficialCards, type OfficialCard } from './officialCards';
import type { CardImport, Character } from './types';
import { CharacterAvatar, CompatibilityReport, ErrorNotice, TavernDialog, buttonClass, inputClass, primaryClass } from './TavernUi';

export default function CardImportDialog({ csrfToken, onImported, onClose }: {
  csrfToken: string; onImported: (character: Character) => void; onClose: () => void;
}) {
  const [preview, setPreview] = useState<CardImport | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string>();
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [browseOfficial, setBrowseOfficial] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const [catalog, setCatalog] = useState<OfficialCard[] | null>(null);
  const [catalogError, setCatalogError] = useState<unknown>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogRevision, setCatalogRevision] = useState(0);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const downloadController = useRef<AbortController | null>(null);
  const revision = useRef(0);
  useEffect(() => () => { revision.current += 1; downloadController.current?.abort(); }, []);
  useEffect(() => {
    if (!browseOfficial) return;
    const controller = new AbortController();
    setCatalogLoading(true); setCatalogError(null);
    void fetchOfficialCards(controller.signal).then(cards => { if (!controller.signal.aborted) setCatalog(cards); })
      .catch(failure => { if (!controller.signal.aborted) setCatalogError(failure); })
      .finally(() => { if (!controller.signal.aborted) setCatalogLoading(false); });
    return () => controller.abort();
  }, [browseOfficial, catalogRevision]);
  useEffect(() => {
    if (preview?.sourceInfo.sourceFormat !== 'png') { setAvatarUrl(undefined); return; }
    // The checked container, never MIME or filename, decides whether it is an avatar.
    const url = URL.createObjectURL(new Blob([preview.sourceFile], { type: 'image/png' }));
    setAvatarUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [preview]);

  async function choose(file?: File, collapseBrowse = false) {
    const currentRevision = ++revision.current;
    downloadController.current?.abort(); downloadController.current = null; setDownloadingId(null);
    setPreview(null); setError(null);
    if (!file) { setReading(false); return; }
    setReading(true);
    try {
      const parsed = await readCardImport(file);
      if (currentRevision === revision.current) { setPreview(parsed); if (collapseBrowse) setBrowseOfficial(false); }
    }
    catch (failure) { if (currentRevision === revision.current) setError(failure); }
    finally { if (currentRevision === revision.current) setReading(false); }
  }
  async function download(card: OfficialCard) {
    if (downloadController.current || saving) return;
    const controller = new AbortController();
    const currentRevision = revision.current;
    downloadController.current = controller; setDownloadingId(card.id); setError(null);
    try {
      const file = await downloadOfficialCard(card, controller.signal);
      if (!controller.signal.aborted && currentRevision === revision.current) await choose(file, true);
    } catch (failure) { if (!controller.signal.aborted && currentRevision === revision.current) setError(failure); }
    finally {
      if (downloadController.current === controller) { downloadController.current = null; setDownloadingId(null); }
    }
  }
  async function confirm() {
    if (!preview || saving) return;
    setSaving(true); setError(null);
    try { onImported(await importCharacter(preview.card, preview.sourceFile, csrfToken)); }
    catch (failure) { setError(failure); setSaving(false); }
  }
  function receiveDroppedFiles(files: FileList) {
    if (saving || !files.length) return;
    if (files.length > 1) {
      revision.current += 1;
      downloadController.current?.abort(); downloadController.current = null; setDownloadingId(null);
      setReading(false);
      setPreview(null);
      setError(new Error('一次只能导入一张角色卡，请只拖入一个 PNG 或 JSON 文件。'));
      return;
    }
    void choose(files[0]);
  }
  return <TavernDialog title="导入角色卡" onClose={onClose} busy={saving}>
    <section className="mb-5 rounded-2xl border border-cyan-500/40 bg-cyan-950/20 p-4">
      <div className="mb-3"><h3 className="text-base font-semibold text-slate-100">从社区找角色卡</h3>
        <p className="mt-1 text-xs leading-5 text-slate-400">从来源网站找到作者发布的原始 PNG / JSON，再回到这里导入。链接将在新标签页打开。</p></div>
      <p className="mb-2 text-xs font-semibold text-cyan-200">国内内容社区</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <a href="https://search.bilibili.com/all?keyword=%E9%85%92%E9%A6%86%E8%A7%92%E8%89%B2%E5%8D%A1" target="_blank" rel="noopener noreferrer" className={`${buttonClass} text-center`}>B 站 · 酒馆角色卡 ↗</a>
        <a href="https://www.douyin.com/search/%E9%85%92%E9%A6%86%E8%A7%92%E8%89%B2%E5%8D%A1" target="_blank" rel="noopener noreferrer" className={`${buttonClass} text-center`}>抖音 · 酒馆角色卡 ↗</a>
        <a href="https://tieba.baidu.com/f?kw=sillytavern" target="_blank" rel="noopener noreferrer" className={`${buttonClass} text-center`}>SillyTavern 吧 ↗</a>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-400">这些是创作者发布内容的社区；下载入口可能在帖子或视频说明中。</p>
      <p className="mb-2 mt-4 text-xs font-semibold text-slate-300">海外角色卡库</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <a href="https://chub.ai/" target="_blank" rel="noopener noreferrer" className={`${buttonClass} text-center`}>Chub ↗</a>
        <a href="https://aicharactercards.com/" target="_blank" rel="noopener noreferrer" className={`${buttonClass} text-center`}>AI Character Cards ↗</a>
        <a href="https://realm.risuai.net/" target="_blank" rel="noopener noreferrer" className={`${buttonClass} text-center`}>RisuRealm ↗</a>
      </div>
      <div role="note" aria-label="下载格式提醒" className="mt-3 rounded-xl border border-amber-400/60 bg-amber-400/10 px-3 py-2.5 text-sm leading-6 text-amber-100">
        <p className="font-bold">⚠ AI Character Cards 下载时别选错版本</p>
        <p>请选 <strong>Download for SillyTavern</strong>，不要选 <strong>Download for Rin Chat</strong>；后者的 .aicc.png 暂不支持导入。</p>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">部分社区卡依赖脚本或外部素材；导入前可查看兼容性报告。</p>
    </section>
    <div aria-label="拖放角色卡" className={`mb-3 rounded-2xl border-2 border-dashed p-5 text-center transition ${dragging ? 'border-cyan-300 bg-cyan-500/15' : 'border-slate-600 bg-slate-950/60'}`}
      onDragEnter={event => { event.preventDefault(); dragDepth.current += 1; setDragging(true); }}
      onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; }}
      onDragLeave={event => { event.preventDefault(); dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDragging(false); }}
      onDrop={event => { event.preventDefault(); dragDepth.current = 0; setDragging(false); receiveDroppedFiles(event.dataTransfer.files); }}>
      <p className="text-sm font-semibold text-slate-100">将角色卡拖到这里</p>
      <p className="mt-1 text-xs text-slate-400">支持 PNG / JSON，最大 8 MiB；先在本地预览，确认后才导入。</p>
    </div>
    <label className="block text-sm">选择 PNG 或 JSON 角色卡
      <input type="file" accept=".png,.json,image/png,application/json" className={`${inputClass} mt-2`} disabled={saving} onChange={event => void choose(event.target.files?.[0])} />
    </label>
    <div className="mt-4 border-t border-slate-700 pt-4">
      <button type="button" className="text-xs font-semibold text-cyan-300 hover:underline" onClick={() => setBrowseOfficial(value => !value)}>
        酒馆官方精选
      </button>
      <p className="mt-1 text-xs text-slate-500">少量官方样例卡，供快速体验。</p>
    </div>
    {browseOfficial && <section aria-label="酒馆精选角色卡" className="mt-3 space-y-3 rounded-xl border border-slate-700 p-3">
      <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">SillyTavern 官方精选 · {catalog?.length ?? '…'} 张</h3>
        <button type="button" className="text-xs text-cyan-300 underline" disabled={catalogLoading} onClick={() => setCatalogRevision(value => value + 1)}>刷新目录</button></div>
      <p className="text-xs text-slate-400">来自 SillyTavern-Content；只展示角色卡，不安装扩展。下载后可先预览再决定是否导入。</p>
      {catalogLoading && <p role="status" className="text-sm text-slate-400">正在读取精选卡…</p>}
      <ErrorNotice error={catalogError} onRetry={() => setCatalogRevision(value => value + 1)} />
      {catalog?.length === 0 && !catalogLoading && <p className="text-sm text-slate-400">当前目录没有可用的 PNG 角色卡。</p>}
      <div className="space-y-2">{catalog?.map(card => <div key={card.id} className="rounded-xl border border-slate-700 bg-slate-950 p-3">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h4 className="break-words text-sm font-semibold">{card.name}</h4>
          {card.description && <p className="mt-1 whitespace-pre-wrap break-words text-xs text-slate-400">{card.description}</p>}</div>
          <button type="button" className={`${buttonClass} shrink-0`} disabled={downloadingId !== null || reading || saving}
            onClick={() => void download(card)} aria-label={`下载并预览 ${card.name}`}>
            {downloadingId === card.id ? '下载中…' : '下载并预览'}
          </button></div>
      </div>)}</div>
    </section>}
    {reading && <p role="status" className="mt-3 text-sm text-cyan-300">正在本地读取…</p>}
    <div className="mt-3"><ErrorNotice error={error} /></div>
    {preview && <section aria-label="导入预览" className="mt-4 space-y-4">
      <div className="flex items-center gap-4"><CharacterAvatar previewUrl={avatarUrl} name={preview.card.name} large />
        <div className="min-w-0"><h3 className="break-words text-xl font-bold">{preview.card.name}</h3>
          <p className="mt-1 break-all text-xs text-slate-400">{preview.sourceInfo.fileName} · {preview.sourceInfo.sourceFormat.toUpperCase()} · {(preview.sourceInfo.fileSize / 1024).toFixed(1)} KiB</p>
          {avatarUrl && <a href={avatarUrl} target="_blank" rel="noreferrer" className="text-xs text-cyan-300 underline">查看 PNG 原图</a>}
        </div></div>
      <p className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-6 text-slate-300">{preview.card.description || '没有角色描述。'}</p>
      <div><h4 className="text-sm font-semibold">默认开场白</h4><p className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-sm text-slate-300">{preview.card.firstMessage || '没有开场白，可直接发送第一条消息。'}</p></div>
      <p className="text-xs text-slate-400">{preview.card.alternateGreetings.length} 个备选开场白 · {preview.card.lorebook.filter(entry => entry.enabled).length} 条启用的基础世界书</p>
      {preview.card.creatorNotes && <details><summary className="cursor-pointer text-sm">作者说明</summary><p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-400">{preview.card.creatorNotes}</p></details>}
      <CompatibilityReport warnings={preview.card.warnings} />
      <button type="button" className={`${primaryClass} w-full`} disabled={saving || reading} onClick={() => void confirm()}>{saving ? '正在导入…' : '确认导入'}</button>
    </section>}
  </TavernDialog>;
}
