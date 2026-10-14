import { useEffect,useRef,useState } from 'react';
import { useQuery,useQueryClient } from '@tanstack/react-query';
import { fetchCharacters,fetchConversation,fetchConversationHistory,openManagementConversation,openTreeConversation } from '../../api/tavernClient';
import { TavernApiError,type Conversation,type ConversationDetail,type ConversationGraph,type ConversationHistory,type ConversationScene,type CompletedTurn,type GenerationSettingsState } from './types';
import type { Wallet } from '../../api/walletClient';
import type { CreditSummary } from '../../api/creditClient';

export interface ConversationOwner{accountId:string;csrfToken:string;userName:string;scene:ConversationScene;areaId?:string;available?:boolean}
export type HistoryCache=ConversationHistory|Conversation[];
export function historyItems(history?:HistoryCache){return Array.isArray(history)?history:history?.conversations??[];}
export function useConversationHistory(owner:ConversationOwner){
  const {accountId,csrfToken,scene,areaId}=owner;const client=useQueryClient();
  const selectionKey=`mapflow.tavern.selection.v1.${accountId}${scene==='management'?'.management':''}${areaId?`.tree.${areaId}`:''}`;
  const [conversationId,setConversationId]=useState<string|null>(()=>{try{return localStorage.getItem(selectionKey);}catch{return null;}});
  const [defaultsBlocked,setDefaultsBlocked]=useState(false);const deletedIds=useRef(new Set<string>());const defaultApplied=useRef(false);
  const charactersKey=['me',accountId,'tavern','characters'] as const;
  const historyKey=areaId?['me',accountId,'learning',areaId,'conversations'] as const:['me',accountId,scene,'conversations'] as const;
  const detailKey=['me',accountId,'tavern','conversation',conversationId] as const;
  const defaultKey=scene==='management'?['me',accountId,'management','default-conversation']:['me',accountId,'tavern','tree-conversation',areaId];
  const characters=useQuery({queryKey:charactersKey,queryFn:({signal})=>fetchCharacters(signal),retry:false});
  const history=useQuery<HistoryCache>({queryKey:historyKey,queryFn:({signal})=>fetchConversationHistory(signal,scene,areaId),retry:false});
  const belongs=(item:Conversation)=>scene==='learning'?item.scene==='learning'&&item.learningAreaId===areaId:(item.scene??'tavern')===scene&&!item.learningAreaId&&!item.libraryEntryId;
  const conversations=historyItems(history.data).filter(belongs).filter(item=>!deletedIds.current.has(item.conversationId));
  const bootstrapState=Array.isArray(history.data)?(conversations.length?'has_active':'never_created'):history.data?.bootstrapState;
  const inScene=conversations.some(item=>item.conversationId===conversationId);
  const detailQuery=useQuery({queryKey:detailKey,queryFn:({signal})=>fetchConversation(conversationId!,signal),enabled:!!conversationId&&inScene,retry:false});
  const detail=inScene&&detailQuery.data&&belongs(detailQuery.data.conversation)?detailQuery.data:undefined;
  function select(id:string|null){setConversationId(id);try{if(id)localStorage.setItem(selectionKey,id);else localStorage.removeItem(selectionKey);}catch{/* Selection is an optional preference. */}}
  function created(saved:ConversationDetail|Conversation){
    const story='conversation' in saved?saved.conversation:saved;
    if(deletedIds.current.has(story.conversationId)||!belongs(story))return;
    void client.cancelQueries({queryKey:historyKey,exact:true});
    client.setQueryData<ConversationHistory>(historyKey,previous=>({bootstrapState:'has_active',conversations:[story,...historyItems(previous).filter(item=>item.conversationId!==story.conversationId)]}));
    if('conversation' in saved)client.setQueryData(['me',accountId,'tavern','conversation',story.conversationId],saved);
    select(story.conversationId);
  }
  const defaultQuery=useQuery({queryKey:defaultKey,enabled:scene!=='tavern'&&owner.available!==false&&history.isSuccess&&!history.isFetching&&bootstrapState==='never_created'&&!defaultsBlocked&&!conversations.length,retry:false,queryFn:async({signal})=>{
    try{return scene==='management'?await openManagementConversation({},csrfToken,signal):await openTreeConversation(areaId!,csrfToken,signal);}
    catch(error){if(error instanceof TavernApiError&&error.code==='tavern.history_cleared'){client.setQueryData<ConversationHistory>(historyKey,{conversations:[],bootstrapState:'cleared'});void history.refetch();}throw error;}
  }});
  useEffect(()=>{if(!history.isSuccess||history.isFetching)return;if(conversationId&&!inScene)select(conversations[0]?.conversationId??null);else if(!conversationId&&conversations.length)select(conversations[0].conversationId);},[history.isSuccess,history.isFetching,conversationId,inScene,conversations[0]?.conversationId]);
  useEffect(()=>{const saved=defaultQuery.data;if(!saved||defaultApplied.current||defaultsBlocked||bootstrapState!=='never_created')return;defaultApplied.current=true;created(saved);void characters.refetch();},[defaultQuery.data,bootstrapState,defaultsBlocked]);
  function recovered(saved:ConversationDetail){
    if(deletedIds.current.has(saved.conversation.conversationId)||!belongs(saved.conversation))return;
    const key=['me',accountId,'tavern','conversation',saved.conversation.conversationId];void client.cancelQueries({queryKey:key,exact:true});
    client.setQueryData<ConversationDetail>(key,previous=>previous&&previous.graph.revision>saved.graph.revision?previous:saved);
    client.setQueryData<ConversationHistory>(historyKey,previous=>previous?{bootstrapState:'has_active',conversations:historyItems(previous).map(item=>item.conversationId===saved.conversation.conversationId?saved.conversation:item)}:previous);
    void client.invalidateQueries({queryKey:['me',accountId,'tree-library']});void client.invalidateQueries({queryKey:['me',accountId,'node-note']});void client.invalidateQueries({queryKey:['me',accountId,'wallet']});void client.invalidateQueries({queryKey:['me',accountId,'credit']});
  }
  function patchGraph(graph:ConversationGraph){if(!conversationId||deletedIds.current.has(conversationId))return;void client.cancelQueries({queryKey:detailKey,exact:true});client.setQueryData<ConversationDetail>(detailKey,previous=>previous?{...previous,graph}:previous);}
  function patchSettings(state:GenerationSettingsState){if(!conversationId||deletedIds.current.has(conversationId))return;void client.cancelQueries({queryKey:detailKey,exact:true});client.setQueryData<ConversationDetail>(detailKey,previous=>previous?{...previous,conversation:{...previous.conversation,...state}}:previous);client.setQueryData<ConversationHistory>(historyKey,previous=>previous?{...previous,conversations:historyItems(previous).map(story=>story.conversationId===conversationId?{...story,...state}:story)}:previous);}
  function completed(receipt:CompletedTurn){
    if(!conversationId||deletedIds.current.has(conversationId))return;
    void client.cancelQueries({queryKey:detailKey,exact:true});client.setQueryData<ConversationDetail>(detailKey,previous=>previous?{...previous,turns:[...previous.turns.filter(turn=>turn.clientTurnId!==receipt.turn.clientTurnId),receipt.turn],...(receipt.canvas?{canvas:receipt.canvas}:{}),...(receipt.generation?{generations:[...previous.generations.filter(generation=>generation.clientActionId!==receipt.generation?.clientActionId),receipt.generation]}:{}),...(receipt.cashCharge?{cashCharges:[...(previous.cashCharges??[]).filter(charge=>charge.generationId!==receipt.cashCharge?.generationId),receipt.cashCharge]}:{}),graph:receipt.graph}:previous);
    if(receipt.walletBalanceMicros!==undefined){const key=['me',accountId,'wallet'];void client.cancelQueries({queryKey:key,exact:true});client.setQueryData<Wallet>(key,previous=>previous?{...previous,balanceMicros:receipt.walletBalanceMicros!}:previous);void client.invalidateQueries({queryKey:key,refetchType:'none'});}
    const creditKey=['me',accountId,'credit'];void client.cancelQueries({queryKey:creditKey,exact:true});client.setQueryData<CreditSummary>(creditKey,previous=>previous?{...previous,balance:receipt.creditBalance}:previous);
    void client.invalidateQueries({queryKey:['me',accountId,'tree-library']});void client.invalidateQueries({queryKey:['me',accountId,'node-note']});
  }
  async function removeDeleted(id:string){
    deletedIds.current.add(id);defaultApplied.current=true;setDefaultsBlocked(true);
    await client.cancelQueries({queryKey:historyKey,exact:true});const remaining=historyItems(client.getQueryData<HistoryCache>(historyKey)).filter(item=>item.conversationId!==id);
    client.setQueryData<ConversationHistory>(historyKey,{conversations:remaining,bootstrapState:remaining.length?'has_active':'cleared'});
    for(const key of [defaultKey,['me',accountId,'tavern','conversation',id]]){await client.cancelQueries({queryKey:key,exact:true});client.removeQueries({queryKey:key,exact:true});}
    try{for(const key of Object.keys(localStorage))if(key.startsWith(`mapflow.tavern.selection.v1.${accountId}`)&&localStorage.getItem(key)===id)localStorage.removeItem(key);sessionStorage.removeItem(`mapflow.tavern.pending.v1.${accountId}.${id}`);}catch{/* Server deletion remains authoritative. */}
    if(conversationId===id)select(remaining.find(belongs)?.conversationId??null);
  }
  return {owner,characters,charactersKey,history,historyKey,conversations,bootstrapState,conversationId,detailKey,detailQuery,detail,select,created,recovered,patchGraph,patchSettings,completed,removeDeleted,setDefaultsBlocked,defaultQuery,deletedIds};
}
