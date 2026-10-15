import {useEffect,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {fetchKnowledgeArticles,fetchKnowledgeArticle,saveKnowledgeArticle,publishKnowledgeRevision,
  unpublishKnowledgeArticle,fetchKnowledgeRevisions,rollbackKnowledgeRevision,deleteKnowledgeArticle,
  knowledgeCategories,type KnowledgeArticle,type KnowledgeDraft,type KnowledgeRevision} from '../../api/assistantKnowledgeClient';
import {describePublicError} from '../../lib/publicErrors';
import {Button} from '../../ui/Button';
import {Dialog} from '../../ui/Dialog';
import {QueryStatus} from '../../ui/QueryStatus';
import SafeMarkdown from '../../ui/SafeMarkdown';
import './assistant-knowledge.css';

const statusNames:Record<string,string>={draft:'未发布',queued:'等待索引',indexing:'索引中',running:'索引中',ready:'已就绪',published:'已发布',failed:'索引失败',unpublished:'已下架',superseded:'任务已过期'};
const isIndexing=(status:string)=>['queued','indexing','running'].includes(status);
const draftFrom=(article:KnowledgeArticle):KnowledgeDraft=>({title:article.title,markdown:article.markdown,category:article.category,
  sourceNote:article.sourceNote,aliases:article.aliases,keywords:article.keywords});
const emptyDraft=():KnowledgeDraft=>({title:'',markdown:'',category:'使用指南',sourceNote:'',aliases:[],keywords:[]});

export default function AssistantKnowledge({accountId,csrfToken}:{accountId:string;csrfToken:string}){
  const [selected,setSelected]=useState<string|null>(null);
  const [creating,setCreating]=useState(false);
  const [editorDirty,setEditorDirty]=useState(false);
  const [pendingSelection,setPendingSelection]=useState<{id:string|null;creating:boolean}|null>(null);
  const [offset,setOffset]=useState(0);
  const select=(id:string|null,newDraft=false)=>{
    if(editorDirty&&(id!==selected||newDraft!==creating)){setPendingSelection({id,creating:newDraft});return;}
    setSelected(id);setCreating(newDraft);setEditorDirty(false);
  };
  const list=useQuery({queryKey:['admin','assistant-knowledge',accountId,offset],queryFn:()=>fetchKnowledgeArticles(offset),
    refetchInterval:query=>query.state.data?.items.some(article=>isIndexing(article.indexStatus))?2500:false});
  const detail=useQuery({queryKey:['admin','assistant-knowledge',accountId,'article',selected],queryFn:()=>fetchKnowledgeArticle(selected!),enabled:!!selected,
    refetchInterval:query=>query.state.data&&isIndexing(query.state.data.indexStatus)?2500:false});
  return <section className="mf-stack">
    <div className="mf-row mf-row--between mf-wrap"><div><h2>助手知识库</h2><p className="mf-muted mf-small">由管理员审核维护，供全局助手查阅。</p></div>
      <Button variant="primary" onClick={()=>select(null,true)}>新建文章</Button></div>
    <p className="mf-knowledge-note">发布的文章可用于向普通用户回答。请勿录入密钥、账号资料或私密运维信息。作者理念须由作者审核。</p>
    <div className="mf-knowledge-layout"><aside className="mf-stack mf-knowledge-list" aria-label="知识库文章">
      <QueryStatus pending={list.isPending} error={list.error} retry={()=>void list.refetch()} />
      {list.data?.items.map(article=><button key={article.articleId} type="button" aria-label={article.title} aria-pressed={selected===article.articleId}
        className="mf-select-record" onClick={()=>select(article.articleId)}>
        <strong>{article.title}</strong><small>{article.category} · {article.publishedRevisionId?'已发布':'未发布'}{isIndexing(article.indexStatus)?' · 正在更新':''}</small></button>)}
      {list.data?.total===0&&<p className="mf-muted mf-small">还没有文章。可先保存草稿，审核后发布。</p>}
      {list.data&&(list.data.total>40||offset>0)&&<div className="mf-row mf-wrap"><Button disabled={offset===0} onClick={()=>setOffset(value=>Math.max(0,value-40))}>上一页</Button>
        <span className="mf-small">{list.data.items.length?`${offset+1}–${Math.min(offset+40,list.data.total)} / `:''}共 {list.data.total} 篇</span>
        <Button disabled={offset+40>=list.data.total} onClick={()=>setOffset(value=>value+40)}>下一页</Button></div>}
    </aside><div className="mf-knowledge-main">
      {!creating&&!selected&&<div className="mf-card mf-stack"><h3>把确定的信息交给助手</h3><p className="mf-muted">选择文章进行编辑，或新建一份草稿。保存草稿不会改变用户正在查阅的版本。</p></div>}
      {selected&&<QueryStatus pending={detail.isPending} error={detail.error} retry={()=>void detail.refetch()} />}
      {(creating||detail.data&&selected)&&<KnowledgeEditor key={creating?'new':selected} initial={creating?null:detail.data!} accountId={accountId} csrfToken={csrfToken}
        onDirtyChange={setEditorDirty} onSelect={id=>{setCreating(false);setSelected(id);setEditorDirty(false);}} onDeleted={()=>setSelected(null)} />}
    </div></div>
    {pendingSelection&&<Dialog title="保留当前修改" onClose={()=>setPendingSelection(null)}><div className="mf-stack"><p>当前文章有未保存的修改。可继续编辑并保存，或放弃修改后切换。</p><div className="mf-row mf-wrap">
      <Button variant="primary" onClick={()=>setPendingSelection(null)}>继续编辑</Button><Button onClick={()=>{setSelected(pendingSelection.id);setCreating(pendingSelection.creating);setEditorDirty(false);setPendingSelection(null);}}>放弃修改并切换</Button>
    </div></div></Dialog>}
  </section>;
}

type Confirmation={kind:'publish'|'unpublish'|'rollback'|'delete'|'reload';operationId:string;revisionId:string;expectedVersion:number;revision?:KnowledgeRevision};
function KnowledgeEditor({initial,accountId,csrfToken,onSelect,onDeleted,onDirtyChange}:{initial:KnowledgeArticle|null;accountId:string;csrfToken:string;onSelect:(id:string)=>void;onDeleted:()=>void;onDirtyChange:(dirty:boolean)=>void}){
  const client=useQueryClient();
  const [saved,setSaved]=useState(initial);
  const [draft,setDraft]=useState<KnowledgeDraft>(()=>initial?draftFrom(initial):emptyDraft());
  const [dirty,setDirty]=useState(false),[preview,setPreview]=useState(false),[busy,setBusy]=useState(false);
  const [error,setError]=useState(''),[notice,setNotice]=useState('');
  const [confirmation,setConfirmation]=useState<Confirmation|null>(null),[history,setHistory]=useState(false);
  const [revisionPreview,setRevisionPreview]=useState<KnowledgeRevision|null>(null);
  const [revisionOffset,setRevisionOffset]=useState(0);
  useEffect(()=>onDirtyChange(dirty),[dirty,onDirtyChange]);
  const revisions=useQuery({queryKey:['admin','assistant-knowledge',accountId,'revisions',saved?.articleId,revisionOffset],queryFn:()=>fetchKnowledgeRevisions(saved!.articleId,revisionOffset),enabled:history&&!!saved});
  useEffect(()=>{
    if(initial&&(!saved||initial.version>saved.version)){
      if(!dirty){setSaved(initial);setDraft(draftFrom(initial));}
    }else if(initial&&saved&&initial.version===saved.version){setSaved(initial);}
  },[initial,saved?.version,dirty]);
  const update=(patch:Partial<KnowledgeDraft>)=>{setDraft(previous=>({...previous,...patch}));setDirty(true);setNotice('');};
  const refresh=async(updated:KnowledgeArticle,preserveDraft=false)=>{
    setSaved(updated);if(!preserveDraft){setDraft(draftFrom(updated));setDirty(false);}
    client.setQueryData(['admin','assistant-knowledge',accountId,'article',updated.articleId],updated);
    await client.invalidateQueries({queryKey:['admin','assistant-knowledge',accountId],refetchType:'active'});
  };
  const save=async()=>{
    setBusy(true);setError('');setNotice('');
    try{const updated=await saveKnowledgeArticle(saved?.articleId??null,{...draft,aliases:draft.aliases.map(value=>value.trim()).filter(Boolean),keywords:draft.keywords.map(value=>value.trim()).filter(Boolean),...(saved?{expectedVersion:saved.version}:{})},csrfToken);
      await refresh(updated);setNotice('草稿已保存，审核后可发布。');if(!saved)onSelect(updated.articleId);
    }catch(failure){setError(describePublicError(failure));}finally{setBusy(false);}
  };
  const confirm=async()=>{
    if(!confirmation||!saved)return;
    setBusy(true);setError('');
    try{
      if(confirmation.kind==='delete'){await deleteKnowledgeArticle(saved.articleId,confirmation.expectedVersion,confirmation.operationId,csrfToken);await client.invalidateQueries({queryKey:['admin','assistant-knowledge',accountId]});onDeleted();return;}
      const publication={expectedVersion:confirmation.expectedVersion,revisionId:confirmation.revisionId,operationId:confirmation.operationId};
      const updated=confirmation.kind==='publish'?await publishKnowledgeRevision(saved.articleId,publication,csrfToken):
        confirmation.kind==='rollback'?await rollbackKnowledgeRevision(saved.articleId,publication,csrfToken):
        confirmation.kind==='unpublish'?await unpublishKnowledgeArticle(saved.articleId,confirmation.expectedVersion,confirmation.operationId,csrfToken):await fetchKnowledgeArticle(saved.articleId);
      await refresh(updated,confirmation.kind==='unpublish'&&dirty);setNotice(confirmation.kind==='unpublish'?'文章已下架，修订记录和当前编辑稿保留。':confirmation.kind==='reload'?'已载入服务器保存的内容。':'已提交索引任务，完成后切换可见版本。');setConfirmation(null);
    }catch(failure){setError(describePublicError(failure));}finally{setBusy(false);}
  };
  const ask=(kind:Confirmation['kind'],revision?:KnowledgeRevision)=>{if(saved)setConfirmation({kind,revision,operationId:crypto.randomUUID(),expectedVersion:saved.version,revisionId:revision?.revisionId??saved.draftRevisionId});};
  const labels={publish:'发布',unpublish:'下架',rollback:'回滚',delete:'删除',reload:'重新载入'};
  return <div className="mf-stack mf-knowledge-editor">
    <div className="mf-row mf-row--between mf-wrap"><h3>{saved?'编辑文章':'新建草稿'}</h3>{saved&&<span className="mf-small mf-muted">{saved.publishedRevisionId?'已有公开版本':'尚未发布'} · {statusNames[saved.indexStatus]??'状态更新中'}</span>}</div>
    {saved?.indexError&&<p role="status" className="mf-status">索引未完成，原发布版本继续保留。可重新提交发布。</p>}
    <form className="mf-stack" onSubmit={event=>{event.preventDefault();void save();}}>
      <fieldset disabled={busy} className="mf-knowledge-fields mf-stack">
        <label className="mf-field">标题<input required maxLength={200} value={draft.title} onChange={event=>update({title:event.target.value})}/></label>
        <div className="mf-grid mf-grid--2"><label className="mf-field">分类<select value={draft.category} onChange={event=>update({category:event.target.value})}>{knowledgeCategories.map(category=><option key={category}>{category}</option>)}</select></label>
          <label className="mf-field">来源说明<input maxLength={2000} value={draft.sourceNote} onChange={event=>update({sourceNote:event.target.value})} placeholder="例如：依据当前产品界面核对" /></label></div>
        <div className="mf-grid mf-grid--2"><label className="mf-field">别名（每行一个）<textarea rows={2} value={draft.aliases.join('\n')} onChange={event=>update({aliases:event.target.value.split('\n')})} /></label>
          <label className="mf-field">关键词（每行一个）<textarea rows={2} value={draft.keywords.join('\n')} onChange={event=>update({keywords:event.target.value.split('\n')})} /></label></div>
        <div className="mf-row mf-row--between mf-wrap"><label htmlFor="knowledge-markdown">正文（Markdown）</label><Button aria-pressed={preview} onClick={()=>setPreview(value=>!value)}>{preview?'返回编辑':'预览正文'}</Button></div>
        {preview?<div className="mf-card mf-knowledge-preview"><SafeMarkdown markdown={draft.markdown}/></div>:<textarea id="knowledge-markdown" className="mf-knowledge-markdown" required rows={14} maxLength={200000} value={draft.markdown} onChange={event=>update({markdown:event.target.value})} />}
        <div className="mf-row mf-wrap"><Button type="submit" variant="primary" disabled={busy||!!saved&&!dirty}>{busy?'处理中…':'保存草稿'}</Button>
          {saved&&<><Button disabled={dirty||busy} onClick={()=>ask('publish')}>发布已保存版本</Button><Button disabled={busy||!saved.publishedRevisionId&&!isIndexing(saved.indexStatus)} onClick={()=>ask('unpublish')}>下架</Button></>}
        </div>
      </fieldset>
    </form>
    {dirty&&saved&&<p className="mf-small mf-muted">有未保存修改。发布前请先保存并预览。</p>}
    {notice&&<p role="status" className="mf-status">{notice}</p>}{error&&!confirmation&&<p role="alert" className="mf-error">{error}</p>}
    {saved&&<div className="mf-row mf-wrap"><Button onClick={()=>setHistory(true)} disabled={busy}>修订记录</Button><Button onClick={()=>ask('reload')} disabled={busy}>重新载入已保存内容</Button><Button variant="danger" onClick={()=>ask('delete')} disabled={busy}>删除文章</Button></div>}
    {history&&<Dialog title="修订记录" onClose={()=>setHistory(false)}><div className="mf-stack"><QueryStatus pending={revisions.isPending} error={revisions.error} retry={()=>void revisions.refetch()}/>
      {revisions.data?.map(revision=><article className="mf-card mf-stack" key={revision.revisionId}><strong>版本 {revision.revisionNumber} · {revision.title}</strong><p className="mf-small mf-muted">{new Date(revision.createdAt).toLocaleString()}</p><div className="mf-row mf-wrap"><Button onClick={()=>{setHistory(false);setRevisionPreview(revision);}}>查看版本 {revision.revisionNumber}</Button><Button disabled={busy||dirty} onClick={()=>{setHistory(false);ask(revision.publishedBefore?'rollback':'publish',revision);}}>{revision.publishedBefore?'回滚到版本':'发布版本'} {revision.revisionNumber}</Button></div></article>)}
      {revisions.data?.length===0&&<p className="mf-muted">暂无修订记录。</p>}{revisions.data&&(revisionOffset>0||revisions.data.length===40)&&<div className="mf-row mf-wrap"><Button disabled={revisionOffset===0} onClick={()=>setRevisionOffset(value=>Math.max(0,value-40))}>较新修订</Button><Button disabled={revisions.data.length<40} onClick={()=>setRevisionOffset(value=>value+40)}>较早修订</Button></div>}</div></Dialog>}
    {revisionPreview&&<Dialog title={`版本 ${revisionPreview.revisionNumber} · ${revisionPreview.title}`} onClose={()=>{setRevisionPreview(null);setHistory(true);}}><SafeMarkdown markdown={revisionPreview.markdown}/></Dialog>}
    {confirmation&&<Dialog title={`${labels[confirmation.kind]}知识库文章`} dismissible={!busy} onClose={()=>setConfirmation(null)}><div className="mf-stack">
      <p>{confirmation.kind==='publish'||confirmation.kind==='rollback'?'索引完成后，这个已保存版本将供普通用户查阅。请确认内容已经审核。':
        confirmation.kind==='unpublish'?'下架后助手将无法检索此文章，旧索引任务也不会重新上架。修订记录仍保留。':confirmation.kind==='reload'?'将用服务器已保存的内容替换当前编辑框，请先保存需要保留的文字。':'删除后撤销公开访问，历史修订仍保留用于审计。'}</p>
      {error&&<p role="alert" className="mf-error">{error}</p>}
      <div className="mf-row mf-wrap"><Button variant={confirmation.kind==='delete'?'danger':'primary'} disabled={busy} onClick={()=>void confirm()}>{busy?'处理中…':`确认${labels[confirmation.kind]}`}</Button><Button disabled={busy} onClick={()=>setConfirmation(null)}>取消</Button></div>
    </div></Dialog>}
  </div>;
}
