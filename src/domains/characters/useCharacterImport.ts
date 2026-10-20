import {useEffect,useRef,useState} from 'react';
import {PublicUiError} from '../../lib/publicErrors';
import {readCardImport} from './cardImport';
import {importCharacter} from '../../api/tavernClient';
import {downloadOfficialCard,fetchOfficialCards,type OfficialCard} from './officialCards';
import type {CardImport,Character} from '../conversations/types';
export function useCharacterImport({csrfToken,onImported,initialBrowseOfficial=false}:{csrfToken:string;onImported:(character:Character)=>void;initialBrowseOfficial?:boolean}){
  const [preview, setPreview] = useState<CardImport | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string>();
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [browseOfficial, setBrowseOfficial] = useState(initialBrowseOfficial);
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
    try { onImported(await importCharacter(preview.card, preview.sourceFile, csrfToken)); setPreview(null); }
    catch (failure) { setError(failure); }
    finally { setSaving(false); }
  }
  function receiveDroppedFiles(files: FileList) {
    if (saving || !files.length) return;
    if (files.length > 1) {
      revision.current += 1;
      downloadController.current?.abort(); downloadController.current = null; setDownloadingId(null);
      setReading(false);
      setPreview(null);
      setError(new PublicUiError('一次只能导入一张角色卡，请只拖入一个 PNG 或 JSON 文件。'));
      return;
    }
    void choose(files[0]);
  }
  return {preview,avatarUrl,reading,saving,error,browseOfficial,setBrowseOfficial,dragging,setDragging,dragDepth,catalog,catalogError,catalogLoading,catalogRevision,setCatalogRevision,downloadingId,choose,download,confirm,receiveDroppedFiles};
}
