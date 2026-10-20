import { useEffect,useMemo,useRef,useState } from 'react';
import { useQuery,useQueryClient } from '@tanstack/react-query';
import { fetchCharacters,fetchConversation,fetchConversationHistory } from '../../api/tavernClient';
import { TavernApiError,type Character,type Conversation,type ConversationDetail,type ConversationGraph,type ConversationHistory,type CompletedTurn,type GenerationSettingsState } from './types';
import type { Wallet } from '../../api/walletClient';
import type { CreditSummary } from '../../api/creditClient';
import { conversationScope,type ConversationOwner } from './conversationScope';
import type { ConversationActionContext } from './useConversationActions';

export type { ConversationOwner } from './conversationScope';
export type HistoryCache=ConversationHistory|Conversation[];
export function historyItems(history?:HistoryCache){return Array.isArray(history)?history:history?.conversations??[];}
export function useConversationHistory(owner:ConversationOwner){
  const {accountId,csrfToken,scene,areaId}=owner;const client=useQueryClient();
  const scope=useMemo(()=>conversationScope(owner),[accountId,csrfToken,scene,areaId,owner.userName,owner.available]);
  const {selectionKey,belongs}=scope;
  const [conversationId,setConversationId]=useState<string|null>(()=>{try{return localStorage.getItem(selectionKey);}catch{return null;}});
  const [defaultsBlocked,setDefaultsBlocked]=useState(false);const deletedIds=useRef(new Set<string>());const defaultApplied=useRef(false);
  const charactersKey=scope.keys.characters;
  const historyKey=scope.keys.history;
  const detailKey=scope.keys.detail(conversationId);
  const defaultKey=scope.keys.default;
  const characters=useQuery({queryKey:charactersKey,queryFn:({signal})=>fetchCharacters(signal),retry:false});
  const history=useQuery<HistoryCache>({queryKey:historyKey,queryFn:({signal})=>fetchConversationHistory(signal,scene,areaId),retry:false});
  const conversations=historyItems(history.data).filter(belongs).filter(item=>!deletedIds.current.has(item.conversationId));
  const bootstrapState=Array.isArray(history.data)?(conversations.length?'has_active':'never_created'):history.data?.bootstrapState;
  const inScene=conversations.some(item=>item.conversationId===conversationId);
  const detailQuery=useQuery({queryKey:detailKey,queryFn:({signal})=>fetchConversation(conversationId!,signal),enabled:!!conversationId&&inScene,retry:false});
  const detail=inScene&&detailQuery.data&&belongs(detailQuery.data.conversation)?detailQuery.data:undefined;
  function select(id:string|null,characterId?:string){
    setConversationId(id);
    try{
      if(id)localStorage.setItem(selectionKey,id);else localStorage.removeItem(selectionKey);
      const agentId=characterId??conversations.find(story=>story.conversationId===id)?.characterId;
      if(scene!=='management'&&id&&agentId)localStorage.setItem(`${selectionKey}.character.${agentId}`,id);
    }catch{/* Selection is an optional preference. */}
  }
  function lastConversationForCharacter(characterId:string){
    const candidates=conversations.filter(story=>story.characterId===characterId);
    try{
      const remembered=localStorage.getItem(`${selectionKey}.character.${characterId}`);
      return candidates.find(story=>story.conversationId===remembered)??candidates[0];
    }catch{return candidates[0];}
  }
  function created(saved:ConversationDetail|Conversation){
    const story='conversation' in saved?saved.conversation:saved;
    if(deletedIds.current.has(story.conversationId)||!belongs(story))return;
    void client.cancelQueries({queryKey:historyKey,exact:true});
    client.setQueryData<ConversationHistory>(historyKey,previous=>({bootstrapState:'has_active',conversations:[story,...historyItems(previous).filter(item=>item.conversationId!==story.conversationId)]}));
    if('conversation' in saved)client.setQueryData(scope.keys.detail(story.conversationId),saved);
    select(story.conversationId,story.characterId);
  }
  const defaultQuery=useQuery({queryKey:defaultKey,enabled:scene!=='tavern'&&owner.available!==false&&history.isSuccess&&!history.isFetching&&bootstrapState==='never_created'&&!defaultsBlocked&&!conversations.length,retry:false,queryFn:async({signal})=>{
    try{return await scope.openDefault(signal);}
    catch(error){if(error instanceof TavernApiError&&error.code==='tavern.history_cleared'){client.setQueryData<ConversationHistory>(historyKey,{conversations:[],bootstrapState:'cleared'});void history.refetch();}throw error;}
  }});
  useEffect(()=>{
    if(!history.isSuccess||history.isFetching)return;
    // A cache notification can render an older selection before React applies a new one.
    // Only repair absent selections; remembering an existing one must never select it again.
    const available=historyItems(client.getQueryData<HistoryCache>(historyKey)).filter(belongs).filter(item=>!deletedIds.current.has(item.conversationId));
    const selected=available.find(item=>item.conversationId===conversationId);
    if(conversationId&&!selected)select(available[0]?.conversationId??null);
    else if(!conversationId&&available.length)select(available[0].conversationId);
    else if(scene!=='management'&&selected){
      const characterKey=`${selectionKey}.character.${selected.characterId}`;
      try{if(!localStorage.getItem(characterKey))localStorage.setItem(characterKey,selected.conversationId);}catch{/* Selection is an optional preference. */}
    }
  },[history.isSuccess,history.isFetching,conversationId,inScene,conversations[0]?.conversationId,scene]);
  useEffect(()=>{const saved=defaultQuery.data;if(!saved||defaultApplied.current||defaultsBlocked||bootstrapState!=='never_created')return;defaultApplied.current=true;created(saved);void characters.refetch();},[defaultQuery.data,bootstrapState,defaultsBlocked]);
  function recovered(saved:ConversationDetail){
    if(deletedIds.current.has(saved.conversation.conversationId)||!belongs(saved.conversation))return;
    const key=scope.keys.detail(saved.conversation.conversationId);void client.cancelQueries({queryKey:key,exact:true});
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
    for(const key of [defaultKey,scope.keys.detail(id)]){await client.cancelQueries({queryKey:key,exact:true});client.removeQueries({queryKey:key,exact:true});}
    try{for(const key of Object.keys(localStorage))if(key.startsWith(`mapflow.tavern.selection.v1.${accountId}`)&&localStorage.getItem(key)===id)localStorage.removeItem(key);sessionStorage.removeItem(`mapflow.tavern.pending.v1.${accountId}.${id}`);}catch{/* Server deletion remains authoritative. */}
    if(conversationId===id)select(remaining.find(belongs)?.conversationId??null);
  }
  const actionContext:ConversationActionContext={
    scope,detail,conversationId,characters:characters.data??[],historyLoaded:history.isSuccess,openingDefault:defaultQuery.isFetching,
    select,lastConversationForCharacter,created,removeDeleted,setDefaultsBlocked,refresh:()=>{void history.refetch();},
    characterRemoved(id){void client.cancelQueries({queryKey:charactersKey,exact:true});client.setQueryData<Character[]>(charactersKey,previous=>previous?.filter(character=>character.characterId!==id));},
    characterImported(character){void client.cancelQueries({queryKey:charactersKey,exact:true});client.setQueryData<Character[]>(charactersKey,previous=>[...(previous??[]).filter(item=>item.characterId!==character.characterId),character]);},
    characterSaved(saved){client.setQueryData<Character[]>(charactersKey,previous=>previous?.map(character=>character.characterId===saved.character.characterId?saved.character:character));if(saved.conversation)recovered(saved.conversation);},
  };
  return {owner,actionContext,characters,charactersKey,history,historyKey,conversations,bootstrapState,conversationId,detailKey,detailQuery,detail,select,lastConversationForCharacter,created,recovered,patchGraph,patchSettings,completed,removeDeleted,setDefaultsBlocked,defaultQuery,deletedIds};
}
