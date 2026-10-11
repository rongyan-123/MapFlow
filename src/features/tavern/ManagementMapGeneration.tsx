import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { IdentityCapabilities } from '../identity/types';
import type { CreditSummary } from '../credit/creditClient';
import TreeGenerationDialog from '../tree-generation/TreeGenerationDialog';
import { readPlatformGenerationEntitlements } from '../tree-generation/treeGenerationClient';
import { fetchMapGenerationDraft, type MapGenerationDraft } from './tavernClient';
import { buttonClass, ErrorNotice } from './TavernUi';

export const mapDraftQueryKey = (accountId:string, conversationId:string) => ['me',accountId,'tavern','conversation',conversationId,'map-generation-draft'] as const;
export default function ManagementMapGeneration({ accountId, conversationId, csrfToken, capabilities, credit, onComplete }: {
  accountId:string; conversationId:string; csrfToken:string; capabilities:IdentityCapabilities['generation'];
  credit:CreditSummary|null; onComplete:(libraryEntryId:string)=>void;
}) {
  const client=useQueryClient();
  const draft=useQuery({queryKey:mapDraftQueryKey(accountId,conversationId),queryFn:({signal})=>fetchMapGenerationDraft(conversationId,signal),retry:false});
  const [reviewing,setReviewing]=useState<MapGenerationDraft|null>(null);
  const [sessionId,setSessionId]=useState<string|null>(null);
  const entitlements=useQuery({queryKey:['me',accountId,'platform-generation-entitlements'],queryFn:readPlatformGenerationEntitlements,
    enabled:!!reviewing&&capabilities.platformFundedEnabled,retry:false});
  const sessionKey=(draftId:string)=>`mapflow.manager-generation.v1.${encodeURIComponent(accountId)}.${encodeURIComponent(conversationId)}.${encodeURIComponent(draftId)}`;
  const changeSession=(id:string|null)=>{
    setSessionId(id);
    if (reviewing) try { if(id) sessionStorage.setItem(sessionKey(reviewing.draftId),id); else sessionStorage.removeItem(sessionKey(reviewing.draftId)); } catch { /* A running generation still has its server-owned session. */ }
  };
  return <>
    {draft.error && <div className="border-b border-slate-800 px-4 py-2"><ErrorNotice error={draft.error} onRetry={()=>void draft.refetch()}/></div>}
    {draft.data && <section aria-label="准备创建的地图" className="flex shrink-0 flex-wrap items-center gap-3 border-b border-cyan-900 bg-slate-900 px-4 py-3 text-sm">
      <div className="min-w-0 flex-1"><p className="text-xs text-slate-400">助手已准备学习需求</p><p className="truncate font-semibold text-cyan-200">{draft.data.input.topic}</p></div>
      {capabilities.enabled && <button className={buttonClass} onClick={()=>{
        const selected=draft.data!; setReviewing(selected);
        try { setSessionId(sessionStorage.getItem(sessionKey(selected.draftId))); } catch { setSessionId(null); }
      }}>核对需求并生成地图</button>}
    </section>}
    {reviewing && <TreeGenerationDialog key={reviewing.draftId} capabilities={capabilities} csrfToken={csrfToken} sessionId={sessionId}
      initialInput={reviewing.input} platformEntitlements={entitlements.data??null} credit={credit}
      onSessionIdChange={changeSession} onPlatformEntitlementsChanged={()=>client.invalidateQueries({queryKey:['me',accountId,'platform-generation-entitlements']})}
      onComplete={entry=>{changeSession(null);setReviewing(null);onComplete(entry);}} onClose={()=>setReviewing(null)}/ >}
  </>;
}
