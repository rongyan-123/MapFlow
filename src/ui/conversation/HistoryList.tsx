import { useEffect,useState } from 'react';
import type { Character,Conversation } from '../../domains/conversations/types';
import { Button,IconButton } from '../Button';
import { CharacterSelector,type CharacterSelection } from './CharacterSelector';
const creationDateFormat=new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
export function HistoryList({items,characters,current,onSelect,onDelete,onNew,onOpenLibrary,allowRoleSelection=true,busy=false,agentSelection,onCollapse}:{items:Conversation[];characters:Character[];current:string|null;onSelect:(id:string)=>void;onDelete:(conversation:Conversation)=>void;onNew:()=>void;onOpenLibrary?:()=>void;allowRoleSelection?:boolean;busy?:boolean;agentSelection?:CharacterSelection;onCollapse?:()=>void}){
  const [search,setSearch]=useState('');
  const [showAll,setShowAll]=useState(false);
  useEffect(()=>setShowAll(false),[agentSelection?.characterId]);
  const scoped=agentSelection?items.filter(item=>showAll||!agentSelection.characterId||item.characterId===agentSelection.characterId):items;
  const ordered=[...scoped].sort((left,right)=>(Date.parse(right.createdAt)||0)-(Date.parse(left.createdAt)||0));
  const visible=ordered.map((item,index)=>({item,number:ordered.length-index})).filter(({item})=>item.title.toLowerCase().includes(search.trim().toLowerCase()));
  return <div className="mf-history-list"><div className="mf-row mf-row--between"><h2>会话历史</h2><span className="mf-muted mf-small">{scoped.length}</span>{onCollapse&&<IconButton className="mf-history-collapse" icon="sidebar" label="收起会话历史" aria-expanded onClick={onCollapse} />}</div>{agentSelection&&<CharacterSelector {...agentSelection} characters={characters} />}<Button variant="primary" disabled={busy} onClick={onNew}>开始新对话</Button>{onOpenLibrary&&<Button onClick={onOpenLibrary}>打开角色库</Button>}<label className="mf-field"><span className="mf-sr-only">搜索会话</span><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="搜索会话" /></label>
    {agentSelection&&items.some(item=>item.characterId!==agentSelection.characterId)&&<Button variant="quiet" aria-pressed={showAll} onClick={()=>setShowAll(previous=>!previous)}>{showAll?'只看当前智能体':'查看全部会话'}</Button>}
    {!scoped.length?<p className="mf-history-empty">还没有会话，先新建一段对话。</p>:!visible.length?<p className="mf-history-empty">没有找到匹配的会话。</p>:<><p className="mf-history-order">按创建时间，最新在前</p><ul>{visible.map(({item,number})=><li key={item.conversationId} data-selected={item.conversationId===current}><button type="button" className="mf-history-item" aria-current={item.conversationId===current?'true':undefined} onClick={()=>onSelect(item.conversationId)}><span className="mf-history-title"><strong>{item.title}</strong>{item.conversationId===current&&<span className="mf-history-current">当前</span>}</span><small>{allowRoleSelection?characters.find(character=>character.characterId===item.characterId)?.card.name??'历史角色':'全局助手'}</small><span className="mf-history-meta"><span>第 {number} 段</span>{Number.isFinite(Date.parse(item.createdAt))?<time dateTime={item.createdAt}>{creationDateFormat.format(new Date(item.createdAt))}</time>:<span>时间未提供</span>}</span></button><IconButton icon="trash" label={`删除会话 ${item.title}`} disabled={busy} onClick={()=>onDelete(item)} /></li>)}</ul></>}
  </div>;
}
