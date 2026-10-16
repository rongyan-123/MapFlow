import { useRef,useState } from 'react';
import { useMutation,useQueryClient } from '@tanstack/react-query';
import { createConversation,createLearningConversation,deleteCharacter,deleteConversation,openManagementConversation } from '../../api/tavernClient';
import { findTeachingCanvasPersistence } from '../canvas/persistence';
import { agentConversationRun } from './agentRun';
import { conversationRun } from './legacyRun';
import { creationStorageKey,persistPendingCreation,readPendingCreation } from './pendingCreation';
import { PublicUiError } from '../../lib/publicErrors';
import { TavernApiError,type Character,type Conversation,type ConversationDetail,type CreateLearningConversationInput } from './types';
import type { useConversationHistory } from './useConversationHistory';

export function useConversationActions(history:ReturnType<typeof useConversationHistory>,busy:boolean,settingsBusy=false){
  const {owner,detail,conversationId}=history;const {accountId,scene,areaId,csrfToken}=owner;const client=useQueryClient();
  const [characterId,setCharacterId]=useState<string|null>(null);const [creating,setCreating]=useState(false);const [switching,setSwitching]=useState<string|null>(null);
  const [deletePhase,setDeletePhase]=useState<'saving'|'deleting'|null>(null);const [error,setError]=useState<unknown>(null);
  const creationLock=useRef(false);const deletionLock=useRef(false);
  const pendingKey=creationStorageKey(accountId,areaId,scene==='management');const pending=useRef<CreateLearningConversationInput|null>(readPendingCreation(pendingKey));
  const selectedCharacter=detail?.character??(scene==='management'?undefined:history.characters.data?.find(character=>character.characterId===characterId)??history.characters.data?.[0]);
  const roleReady=scene==='management'||(selectedCharacter?history.characters.data?.some(character=>character.characterId===selectedCharacter.characterId):scene!=='tavern');
  const creationReady=history.history.isSuccess&&!history.defaultQuery.isFetching&&owner.available!==false&&!deletePhase&&!creating&&!switching&&!busy&&!settingsBusy&&(!conversationId||!!detail);
  const canCreate=creationReady&&!!roleReady;
  async function create(characterOverride?:Character){
    const targetCharacter=characterOverride??selectedCharacter;
    const targetReady=scene==='management'||(targetCharacter?history.characters.data?.some(character=>character.characterId===targetCharacter.characterId):scene!=='tavern');
    if(creationLock.current||deletionLock.current||!creationReady||!targetReady)return false;
    if(scene==='learning'&&pending.current?.characterId&&pending.current.characterId!==targetCharacter?.characterId){
      setError(new PublicUiError('另一个角色的新建请求待确认，请先切回该角色重试新建。'));return false;
    }
    creationLock.current=true;setCreating(true);setError(null);
    const previous=scene!=='management'&&detail?.character.characterId!==targetCharacter?.characterId?undefined:detail?.conversation;
    try{
      const input={...(scene!=='management'&&targetCharacter?{characterId:targetCharacter.characterId}:{}),userName:previous?.userName??owner.userName,...(previous?.persona?{persona:previous.persona}:{}),...(previous?.vocabulary?{vocabulary:previous.vocabulary}:{}),greetingIndex:0};
      if(scene==='learning'||scene==='management'){
        const request=pending.current??{...input,clientRequestId:crypto.randomUUID(),...(scene==='learning'?{toolsEnabled:previous?.treeToolsEnabled===true}:{})};pending.current=request;persistPendingCreation(pendingKey,request);
        const created=scene==='learning'?await createLearningConversation(areaId!,request,csrfToken):await openManagementConversation({...request,newConversation:true},csrfToken);
        pending.current=null;persistPendingCreation(pendingKey,null);history.created(created);
      }else if(targetCharacter)history.created(await createConversation({...input,characterId:targetCharacter.characterId},csrfToken));
      return true;
    }catch(failure){
      if(failure instanceof TavernApiError&&(failure.code==='tavern.creation_target_deleted'||(scene==='management'&&failure.code==='tavern.character_not_found'))){
        const requestId=pending.current?.clientRequestId;if(requestId&&readPendingCreation(pendingKey)?.clientRequestId===requestId)persistPendingCreation(pendingKey,null);pending.current=null;void history.history.refetch();
      }setError(failure);return false;
    }finally{creationLock.current=false;setCreating(false);}
  }
  async function remove(target:Conversation){
    if(deletionLock.current||creating||settingsBusy||(target.conversationId===conversationId&&busy))return;
    const canvas=findTeachingCanvasPersistence(client,accountId,target.conversationId);
    const legacy=conversationRun(client,{accountId,scene:target.scene??scene,areaId:target.learningAreaId??null,conversationId:target.conversationId},()=>null);
    const native=agentConversationRun(client,accountId,target.conversationId);const state=native.getSnapshot();
    if(legacy.getSnapshot().busy||legacy.getSnapshot().pendingGeneration||state.busy||(state.pendingGeneration&&!state.state)||(state.state&&!['succeeded','failed','stopped'].includes(state.state))){setError(new PublicUiError('会话仍在生成或等待处理，请完成后再删除。'));return;}
    deletionLock.current=true;setError(null);setDeletePhase('saving');history.setDefaultsBlocked(true);
    try{
      try{await canvas?.prepareDeletion();}catch{throw new PublicUiError('画布尚未保存成功。请重试保存后删除，或取消删除。');}
      setDeletePhase('deleting');await deleteConversation(target.conversationId,csrfToken);
      canvas?.markDeleted();native.markDeleted();legacy.cancel();legacy.set({pendingGeneration:null,draft:'',process:[],error:null,canvasPreview:null});await history.removeDeleted(target.conversationId);
    }catch(failure){canvas?.cancelDeletion();history.setDefaultsBlocked(false);setError(failure);}
    finally{deletionLock.current=false;setDeletePhase(null);}
  }
  async function chooseCharacter(character:Character){
    if(scene==='management'||creationLock.current||deletionLock.current||settingsBusy||busy||!history.history.isSuccess||owner.available===false)return false;
    setCharacterId(character.characterId);setError(null);
    setSwitching(character.characterId);
    try{
      const existing=history.lastConversationForCharacter(character.characterId);
      if(existing)history.select(existing.conversationId);
      else return await create(character);
      return true;
    }finally{setSwitching(null);}
  }
  const characterRemoval=useMutation({mutationFn:(id:string)=>deleteCharacter(id,csrfToken),onSuccess:(_receipt,id)=>{void client.cancelQueries({queryKey:history.charactersKey,exact:true});client.setQueryData<Character[]>(history.charactersKey,previous=>previous?.filter(character=>character.characterId!==id));if(characterId===id)setCharacterId(null);}});
  function imported(character:Character){void client.cancelQueries({queryKey:history.charactersKey,exact:true});client.setQueryData<Character[]>(history.charactersKey,previous=>[...(previous??[]).filter(item=>item.characterId!==character.characterId),character]);setCharacterId(character.characterId);}
  function characterSaved(saved:{character:Character;conversation:ConversationDetail|null}){client.setQueryData<Character[]>(history.charactersKey,previous=>previous?.map(character=>character.characterId===saved.character.characterId?saved.character:character));if(saved.conversation)history.recovered(saved.conversation);}
  return {selectedCharacter,canCreate,creating,switching,deletePhase,error,setError,create,remove,chooseCharacter,characterRemoval,imported,characterSaved};
}
