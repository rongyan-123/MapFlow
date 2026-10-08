import { useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { TavernDialog, buttonClass } from './TavernUi';

const commands = [
  ['selection','选择','KeyV','Digit1'],['hand','抓手 / 移动画布','KeyH',''],['rectangle','矩形','KeyR','Digit2'],
  ['diamond','菱形','KeyD','Digit3'],['ellipse','椭圆','KeyO','Digit4'],['arrow','箭头','KeyA','Digit5'],
  ['line','线段','KeyL','Digit6'],['freedraw','自由绘制','KeyP','Digit7'],['text','文字','KeyT','Digit8'],
  ['eraser','橡皮擦','KeyE','Digit0'],['lock','锁定工具','KeyQ',''],['library','素材库','Digit9',''],
  ['undo','撤销','Ctrl+KeyZ','Meta+KeyZ'],['redo','重做','Ctrl+Shift+KeyZ','Meta+Shift+KeyZ'],
  ['delete','删除选中内容','Delete','Backspace'],['selectAll','全选','Ctrl+KeyA','Meta+KeyA'],
  ['zoomIn','放大','Equal','NumpadAdd'],['zoomOut','缩小','Minus','NumpadSubtract'],
  ['fit','适应画布','Shift+Digit1','Shift+Digit2'],['help','快捷键','Shift+Slash',''],
] as const;
type Bindings = Record<string,[string,string]>;
const defaults = ():Bindings => Object.fromEntries(commands.map(([id,,first,second])=>[id,[first,second]]));
function chord(event:KeyboardEvent):string {
  const code=event.code || (event.key.length===1 ? (/^[0-9]$/.test(event.key)?`Digit${event.key}`:`Key${event.key.toUpperCase()}`):event.key);
  return [event.ctrlKey?'Ctrl':'',event.metaKey?'Meta':'',event.altKey?'Alt':'',event.shiftKey?'Shift':'',code].filter(Boolean).join('+');
}
const label=(binding:string)=>binding.replace(/Key/g,'').replace(/Digit/g,'')||'未绑定';
const bypass=new WeakSet<KeyboardEvent>();

export default function CanvasShortcuts({api,root,busy,accountId='local'}:{api:RefObject<ExcalidrawImperativeAPI>,root:RefObject<HTMLElement>,busy:boolean,accountId?:string}) {
  const storageKey=`mapflow.canvas.shortcuts.v1.${accountId}`;
  const [bindings,setBindings]=useState<Bindings>(()=>{
    try {const saved=JSON.parse(localStorage.getItem(storageKey)||'null');
      if (saved&&commands.every(([id])=>Array.isArray(saved[id])&&saved[id].length===2&&saved[id].every((v:unknown)=>typeof v==='string'))) return saved;
    }catch{/* Browser storage is optional. */}return defaults();
  });
  const [open,setOpen]=useState(false);
  const [listening,setListening]=useState<{id:string;slot:0|1}|null>(null);
  const [conflict,setConflict]=useState('');
  const current=useRef({bindings,open,listening,busy});current.current={bindings,open,listening,busy};
  function save(next:Bindings) {setBindings(next);try{localStorage.setItem(storageKey,JSON.stringify(next));}catch{/* Keep bindings for this view. */}}
  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{
      if(bypass.has(event)||event.isComposing)return;
      const state=current.current;
      if(state.open) {
        if(!state.listening)return;
        event.preventDefault();event.stopPropagation();
        if(event.key==='Escape'){setListening(null);return;}
        if(['Control','Shift','Alt','Meta'].includes(event.key))return;
        const next=chord(event);
        const used=commands.find(([id])=>state.bindings[id].some((key,slot)=>key===next&&(id!==state.listening!.id||slot!==state.listening!.slot)));
        if(used){setConflict(`已绑定到“${used[1]}”，请先清除该绑定。`);return;}
        const updated=structuredClone(state.bindings);updated[state.listening.id][state.listening.slot]=next;
        save(updated);setListening(null);setConflict('');return;
      }
      const target=event.target as HTMLElement|null;
      if(state.busy||!target||target.closest('input,textarea,select,[contenteditable="true"],[role="textbox"]')||!root.current?.contains(target))return;
      const key=chord(event);
      const command=commands.find(([id])=>state.bindings[id].includes(key));
      if(!command) {
        if(commands.some(([, ,first,second])=>first===key||second===key)){event.preventDefault();event.stopPropagation();}
        return;
      }
      event.preventDefault();event.stopPropagation();
      const instance=api.current;if(!instance)return;
      const [id]=command;
      if(id==='help'){setOpen(true);return;}
      if(id==='library'){instance.toggleSidebar({name:'library'});return;}
      if(id==='lock'){instance.updateScene({appState:{activeTool:{...instance.getAppState().activeTool,locked:!instance.getAppState().activeTool.locked}}});return;}
      if(['selection','hand','rectangle','diamond','ellipse','arrow','line','freedraw','text','eraser'].includes(id)) {
        instance.setActiveTool({type:id as 'selection'});return;
      }
      const native=command[2];
      const parts=native.split('+');const code=parts[parts.length-1];
      const nativeKey=code.startsWith('Key')?code.slice(3).toLowerCase():code.startsWith('Digit')?code.slice(5):code==='Equal'?'=':code==='Minus'?'-':code;
      const forwarded=new KeyboardEvent('keydown',{key:nativeKey,code,ctrlKey:parts.includes('Ctrl'),metaKey:parts.includes('Meta'),shiftKey:parts.includes('Shift'),bubbles:true,cancelable:true});
      bypass.add(forwarded);target.dispatchEvent(forwarded);
    };
    document.addEventListener('keydown',onKey,true);return()=>document.removeEventListener('keydown',onKey,true);
  },[storageKey]);
  return <>
    <button type="button" className={buttonClass} onClick={()=>setOpen(true)}>快捷键</button>
    {open&&createPortal(<div className="canvas-shortcuts-layer"><TavernDialog title="画布快捷键" onClose={()=>{setOpen(false);setListening(null);}}>
      <p className="mb-3 text-sm text-slate-400">点击绑定，再按下按键组合。仅在画布内生效，不影响聊天输入。</p>
      {conflict&&<p role="alert" className="mb-3 text-amber-300">{conflict}</p>}
      <div className="grid grid-cols-[minmax(120px,1fr)_1fr_1fr] gap-2 text-sm">
        <strong>功能</strong><strong>主要绑定</strong><strong>备用绑定</strong>
        {commands.map(([id,name])=><div key={id} className="contents"><span className="self-center">{name}</span>{([0,1] as const).map(slot=><div key={slot} className="flex gap-1">
          <button type="button" aria-label={`${name}：${slot===0?'主要':'备用'}绑定`} className={`${buttonClass} min-w-0 flex-1`} onClick={()=>{setListening({id,slot});setConflict('');}}>{listening?.id===id&&listening.slot===slot?'按下按键…':label(bindings[id][slot])}</button>
          <button type="button" className="px-1 text-slate-400" aria-label={`清除${name}的${slot===0?'主要':'备用'}绑定`} onClick={()=>{const next=structuredClone(bindings);next[id][slot]='';save(next);}}>×</button>
        </div>)}</div>)}
      </div><button type="button" className={`${buttonClass} mt-4`} onClick={()=>{save(defaults());setListening(null);setConflict('');}}>恢复默认绑定</button>
    </TavernDialog></div>,document.body)}
  </>;
}
