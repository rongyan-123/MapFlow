import { useEffect,useState } from 'react';
import type { PersonalTreeDetail } from '../../domains/maps/types';
import { downloadTreeExport } from '../../domains/maps/treeExport';
import { describePublicError } from '../../lib/publicErrors';
import { Button } from '../Button';
import { Dialog } from '../Dialog';
interface Props{detail:PersonalTreeDetail|null;loadDetail?:()=>Promise<PersonalTreeDetail>;triggerAriaLabel?:string;compact?:boolean;variant?:'default'|'drawer'}
export default function ExportControl({detail,loadDetail,triggerAriaLabel='导出技能树'}:Props){
  const [open,setOpen]=useState(false);const [loading,setLoading]=useState(false);const [loaded,setLoaded]=useState(detail);const [error,setError]=useState<string|null>(null);
  useEffect(()=>{setLoaded(detail);},[detail]);
  async function show(){setError(null);if(detail??loaded){setOpen(true);return;}if(!loadDetail){setError('当前技能树详情暂不可用。');return;}setLoading(true);try{setLoaded(await loadDetail());setOpen(true);}catch(failure){setError(describePublicError(failure));}finally{setLoading(false);}}
  function download(format:'json'|'markdown'){const selected=detail??loaded;if(!selected)return;setOpen(false);downloadTreeExport(selected,format);}
  return <><Button disabled={loading} aria-label={triggerAriaLabel} aria-haspopup="dialog" aria-expanded={open} aria-busy={loading} onClick={()=>void show()}><span>导出地图</span></Button>{error&&<p role="alert" className="mf-status mf-status--error">{error}</p>}{open && <Dialog title="导出技能树" onClose={()=>setOpen(false)}><div className="mf-stack"><p className="mf-muted">保存完整结构，或导出为便于阅读的学习清单。</p><Button onClick={()=>download('json')}>下载 JSON（完整结构）</Button><Button onClick={()=>download('markdown')}>下载 Markdown（便于阅读）</Button></div></Dialog>}</>;
}
