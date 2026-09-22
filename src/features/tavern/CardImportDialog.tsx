import { useEffect, useRef, useState } from 'react';
import { readCardImport } from './cardImport';
import { importCharacter } from './tavernClient';
import type { CardImport, Character } from './types';
import { CharacterAvatar, CompatibilityReport, ErrorNotice, TavernDialog, inputClass, primaryClass } from './TavernUi';

export default function CardImportDialog({ csrfToken, onImported, onClose }: { csrfToken: string; onImported: (character: Character) => void; onClose: () => void }) {
  const [preview, setPreview] = useState<CardImport | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string>();
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const revision = useRef(0);
  useEffect(() => () => { revision.current += 1; }, []);
  useEffect(() => {
    if (preview?.sourceInfo.sourceFormat !== 'png') { setAvatarUrl(undefined); return; }
    // The checked container, never MIME or filename, decides whether it is an avatar.
    const url = URL.createObjectURL(new Blob([preview.sourceFile], { type: 'image/png' }));
    setAvatarUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [preview]);

  async function choose(file?: File) {
    const currentRevision = ++revision.current;
    setPreview(null); setError(null);
    if (!file) { setReading(false); return; }
    setReading(true);
    try { const parsed = await readCardImport(file); if (currentRevision === revision.current) setPreview(parsed); }
    catch (failure) { if (currentRevision === revision.current) setError(failure); }
    finally { if (currentRevision === revision.current) setReading(false); }
  }
  async function confirm() {
    if (!preview || saving) return;
    setSaving(true); setError(null);
    try { onImported(await importCharacter(preview.card, preview.sourceFile, csrfToken)); }
    catch (failure) { setError(failure); setSaving(false); }
  }
  return <TavernDialog title="导入角色卡" onClose={onClose} busy={saving}>
    <p className="mb-3 text-sm leading-6 text-slate-400">选择普通 V1 / V2 / V3 角色卡，先在本地查看预览。原始文件最大 8 MiB。</p>
    <label className="block text-sm">选择 PNG 或 JSON 角色卡
      <input type="file" accept=".png,.json,image/png,application/json" className={`${inputClass} mt-2`} disabled={saving} onChange={event => void choose(event.target.files?.[0])} />
    </label>
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
