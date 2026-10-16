import { useLayoutEffect,useRef,useState,type ReactNode,type RefObject } from 'react';
import type { ConversationScene } from '../../domains/conversations/types';
import { PageHeader } from '../PageHeader';
import { Button,IconButton } from '../Button';
import { Icon,type IconName } from '../Icon';
import ResizeHandle from '../ResizeHandle';
import {Dialog} from '../Dialog';

const guides:Array<{label:string;caption:string;prompt:string;icon:IconName}>=[
  {label:'创建一张学习地图',caption:'把学习目标变成清晰的路线',prompt:'帮我创建一张学习地图，我想学：',icon:'map'},
  {label:'梳理学习路线',caption:'理清前置知识，找到下一步',prompt:'帮我梳理学习路线，我目前的基础是：',icon:'learn'},
  {label:'解释一个知识点',caption:'换一种说法，也可以画图理解',prompt:'请帮我解释这个知识点：',icon:'book'},
  {label:'查看学习进度',caption:'回顾已学的内容，继续向前',prompt:'帮我回顾目前的学习进度，建议接下来学什么。',icon:'check'},
];
const learningGuides=[guides[2],guides[3],{label:'从当前地图开始',caption:'先了解路线，再安排今天的学习',prompt:'请介绍这张地图的学习路线，帮我选择今天的起点。',icon:'map' as const},{label:'练一练',caption:'用一道小题检查理解',prompt:'请围绕当前学习内容出一道练习题，等我作答后再讲解。',icon:'learn' as const}];
const tavernGuides=[{label:'继续故事',caption:'从角色的开场接着聊',prompt:'接着说说你的故事吧。',icon:'spark' as const},{label:'认识一下',caption:'和当前角色打个招呼',prompt:'你好，先介绍一下自己吧。',icon:'chat' as const},{label:'聊一个话题',caption:'按自己的兴趣展开',prompt:'我想和你聊聊：',icon:'book' as const},{label:'一起想办法',caption:'换个角度思考遇到的事',prompt:'我遇到了一件事，想听听你的看法：',icon:'learn' as const}];
export interface ConversationWorkspaceProps{
  scene:ConversationScene;title:string;draft:string;onDraftChange:(draft:string)=>void;onSend:()=>void;
  onStop?:()=>void;sending?:boolean;disabled?:boolean;sendDisabled?:boolean;modelLabel:string;onConfigure:()=>void;onNew:()=>void;onHistory:()=>void;onCanvas:()=>void;
  welcome?:boolean;welcomeExtra?:ReactNode;children?:ReactNode;footerExtra?:ReactNode;headerContext?:ReactNode;headerExtra?:ReactNode;headerTitle?:ReactNode;
  history?:ReactNode;sidePane?:ReactNode;sidePaneKind?:'canvas'|'map';sidePaneWide?:boolean;resizeKey?:string;composerRef?:RefObject<HTMLTextAreaElement>;logRef?:RefObject<HTMLDivElement>;onScroll?:()=>void;
}
export function ConversationWorkspace(props:ConversationWorkspaceProps){
  const [moreOpen,setMoreOpen]=useState(false);
  const sidePane=useRef<HTMLDivElement>(null);const previousWide=useRef(props.sidePaneWide);
  useLayoutEffect(()=>{
    if(previousWide.current===props.sidePaneWide)return;previousWide.current=props.sidePaneWide;
    const panel=sidePane.current;if(!panel)return;panel.style.removeProperty('--panel-width');
    const separator=panel.parentElement?.querySelector('.mf-resize-handle');separator?.setAttribute('aria-valuenow',String(Math.round(panel.getBoundingClientRect().width)));
    if(props.resizeKey)try{localStorage.removeItem(props.resizeKey);}catch{/* The requested preset still applies without storage. */}
  },[props.sidePaneWide,props.resizeKey]);
  const fallbackComposer=useRef<HTMLTextAreaElement>(null);const composer=props.composerRef??fallbackComposer;
  useLayoutEffect(()=>{const field=composer.current;if(!field)return;field.style.height='auto';field.style.height=`${Math.min(144,Math.max(44,field.scrollHeight))}px`;},[props.draft,composer]);
  const fill=(prompt:string)=>{props.onDraftChange(prompt);composer.current?.focus();};
  const sceneGuides=props.scene==='learning'?learningGuides:props.scene==='tavern'?tavernGuides:guides;
  return <section className="mf-conversation-workspace">
    <PageHeader title={props.title} titleControl={props.headerTitle} context={props.headerContext} actions={<>
      {props.headerExtra}<IconButton className="mf-chat-secondary" icon="menu" label="会话历史" onClick={props.onHistory} /><IconButton className="mf-chat-secondary" icon="plus" label="新建会话" onClick={props.onNew} />
      <IconButton icon="settings" label="配置" onClick={props.onConfigure} /><IconButton className="mf-chat-secondary" icon="edit" label="教学画布" onClick={props.onCanvas} /><IconButton className="mf-chat-more" icon="more" label="更多聊天操作" onClick={()=>setMoreOpen(true)} />
    </>} />
    <div className="mf-conversation-body">{props.history}<div data-side-pane={props.sidePane?props.sidePaneKind:undefined} className={`mf-chat-layout ${props.sidePane?'mf-chat-layout--split':''} ${props.sidePaneWide?'mf-chat-layout--wide':''}`}>{props.sidePane && <div ref={sidePane} className="mf-chat-side-pane">{props.sidePane}</div>}{props.sidePane&&props.resizeKey&&<ResizeHandle label="调整画布与聊天宽度" storageKey={props.resizeKey} remainingWidth={320} />}<div className="mf-chat-column">
      <div className="mf-chat-scroll" onScroll={props.onScroll} ref={props.logRef}>
        {props.welcome && <div className="mf-chat-welcome"><span className="mf-welcome-mark"><Icon name={props.scene==='management'?'spark':props.scene==='learning'?'learn':'chat'} /></span><p className="mf-eyebrow">{props.scene==='management'?'YOUR LEARNING STARTS HERE':props.scene==='learning'?'ONE STEP AT A TIME':'A NEW CONVERSATION'}</p><h2>{props.scene==='management'?'下一步，你想学什么？':props.scene==='learning'?'从一个知识点，开始理解。':'每个智能体，都有自己的对话。'}</h2><p>{props.scene==='management'?'告诉我你的目标，一起把它变成可以走的路。':props.scene==='learning'?'结合你的地图提问、练习，或用画布一起理清思路。':'在上方或侧栏切换智能体，各自的会话独立保留。角色库中新建、导入后，即可直接选用。'}</p><div className="mf-guide-grid">{sceneGuides.map(guide=><button type="button" className="mf-guide" data-guide={guide.icon} key={guide.label} aria-label={guide.label} onClick={()=>fill(guide.prompt)}><span className="mf-guide-icon"><Icon name={guide.icon} /></span><span><strong>{guide.label}</strong><small>{guide.caption}</small></span><Icon name="right" /></button>)}</div>{props.welcomeExtra}</div>}
        <div role="log" aria-label="对话消息" aria-live="polite" aria-relevant="additions" className="mf-chat-log">{props.children}</div>
      </div>
      <div className="mf-composer-area">{props.footerExtra}<form className="mf-composer" onSubmit={event=>{event.preventDefault();if(!props.disabled&&!props.sendDisabled&&!props.sending&&props.draft.trim())props.onSend();}}>
        <textarea ref={composer} aria-label="消息" rows={1} placeholder="输入你想聊的内容…" value={props.draft} disabled={props.disabled} onChange={event=>props.onDraftChange(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing&&window.matchMedia('(min-width:768px)').matches){event.preventDefault();if(!props.disabled&&!props.sendDisabled&&!props.sending&&props.draft.trim())props.onSend();}}} />
        <div className="mf-composer-bottom"><button type="button" className="mf-model-chip" onClick={props.onConfigure}><Icon name="spark" /><span>{props.modelLabel}</span><Icon name="down" /></button><small className="mf-desktop-only">Enter 发送 · Shift+Enter 换行</small>{props.sending?<IconButton icon="stop" label="停止生成" className="mf-send" onClick={props.onStop} />:<IconButton icon="arrow" label="发送" className="mf-send" type="submit" disabled={props.disabled||props.sendDisabled||!props.draft.trim()} />}</div>
      </form><p className="mf-composer-note">AI 的建议可以参考，理解和判断属于你。</p></div>
    </div></div></div>
    {moreOpen&&<Dialog title="聊天操作" onClose={()=>setMoreOpen(false)}><div className="mf-stack"><Button onClick={()=>{setMoreOpen(false);props.onHistory();}}>查看会话历史</Button><Button onClick={()=>{setMoreOpen(false);props.onNew();}}>创建新会话</Button><Button onClick={()=>{setMoreOpen(false);props.onCanvas();}}>打开或收起教学画布</Button></div></Dialog>}
  </section>;
}
