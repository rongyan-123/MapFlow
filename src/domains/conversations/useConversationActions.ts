import { useRef,useState } from 'react';
import { useMutation,useQueryClient } from '@tanstack/react-query';
import { deleteCharacter,deleteConversation } from '../../api/tavernClient';
import { findTeachingCanvasPersistence } from '../canvas/persistence';
import { agentConversationRun } from './agentRun';
import { conversationRun } from './legacyRun';
import { PublicUiError } from '../../lib/publicErrors';
import type { Character,Conversation,ConversationDetail } from './types';
import { isTerminalCreationError,type ConversationScope } from './conversationScope';

export interface ConversationActionContext {
  scope:ConversationScope;
  detail:ConversationDetail|undefined;
  conversationId:string|null;
  characters:Character[];
  historyLoaded:boolean;
  openingDefault:boolean;
  select:(id:string|null)=>void;
  lastConversationForCharacter:(id:string)=>Conversation|undefined;
  created:(saved:ConversationDetail|Conversation)=>void;
  removeDeleted:(id:string)=>Promise<void>;
  setDefaultsBlocked:(blocked:boolean)=>void;
  refresh:()=>void;
  characterImported:(character:Character)=>void;
  characterSaved:(saved:{character:Character;conversation:ConversationDetail|null})=>void;
  characterRemoved:(id:string)=>void;
}

export function useConversationActions(history:ConversationActionContext,busy:boolean,settingsBusy=false){
  const {scope,detail,conversationId}=history;const owner=scope.owner;const {accountId,scene,csrfToken}=owner;const client=useQueryClient();
  const [characterId,setCharacterId]=useState<string|null>(null);const [creating,setCreating]=useState(false);const [switching,setSwitching]=useState<string|null>(null);
  const [deletePhase,setDeletePhase]=useState<'saving'|'deleting'|null>(null);const [error,setError]=useState<unknown>(null);
  const creationLock=useRef(false);const deletionLock=useRef(false);
  const selectedCharacter=detail?.character??(scene==='management'?undefined:history.characters.find(character=>character.characterId===characterId)??history.characters[0]);
  const roleReady=scene==='management'||(selectedCharacter?history.characters.some(character=>character.characterId===selectedCharacter.characterId):scene!=='tavern');
  const creationReady=history.historyLoaded&&!history.openingDefault&&owner.available!==false&&!deletePhase&&!creating&&!switching&&!busy&&!settingsBusy&&(!conversationId||!!detail);
  const canCreate=creationReady&&!!roleReady;
  async function create(characterOverride?:Character){
    const targetCharacter=characterOverride??selectedCharacter;
    const targetReady=scene==='management'||(targetCharacter?history.characters.some(character=>character.characterId===targetCharacter.characterId):scene!=='tavern');
    if(creationLock.current||deletionLock.current||!creationReady||!targetReady)return false;
    creationLock.current=true;setCreating(true);setError(null);
    try{
      history.created(await scope.create(targetCharacter,detail?.conversation));
      return true;
    }catch(failure){
      if(isTerminalCreationError(scene,failure))history.refresh();
      setError(failure);return false;
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
    if(scene==='management'||creationLock.current||deletionLock.current||settingsBusy||busy||!history.historyLoaded||owner.available===false)return false;
    setCharacterId(character.characterId);setError(null);
    setSwitching(character.characterId);
    try{
      const existing=history.lastConversationForCharacter(character.characterId);
      if(existing)history.select(existing.conversationId);
      else return await create(character);
      return true;
    }finally{setSwitching(null);}
  }
  const characterRemoval=useMutation({mutationFn:(id:string)=>deleteCharacter(id,csrfToken),onSuccess:(_receipt,id)=>{history.characterRemoved(id);if(characterId===id)setCharacterId(null);}});
  function imported(character:Character){history.characterImported(character);setCharacterId(character.characterId);}
  return {selectedCharacter,canCreate,creating,switching,deletePhase,error,setError,create,remove,chooseCharacter,characterRemoval,imported,characterSaved:history.characterSaved};
}
