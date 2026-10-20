import { useEffect,useRef,useState,type ReactNode } from 'react';
import { Dialog } from '../Dialog';
export type ConfigurationSection='overview'|'model'|'tools'|'profile'|'branches';
const sections:[ConfigurationSection,string][]=[['overview','角色与会话'],['model','模型接入'],['tools','技能树与工具'],['profile','会话设定'],['branches','历史与分支']];
export function ConfigurationDialog({content,onClose,busy=false,initialSection='overview'}:{content:Record<ConfigurationSection,ReactNode>;onClose:()=>void;busy?:boolean;initialSection?:ConfigurationSection}){
  const [selected,setSelected]=useState(initialSection);
  const navigation=useRef<HTMLElement>(null);
  useEffect(()=>{
    const row=navigation.current;if(!row)return;
    const onWheel=(event:WheelEvent)=>{
      const maximum=row.scrollWidth-row.clientWidth;
      if(maximum<=1||event.ctrlKey||event.shiftKey||Math.abs(event.deltaX)>=Math.abs(event.deltaY))return;
      const step=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?row.clientWidth:1);
      const next=Math.max(0,Math.min(maximum,row.scrollLeft+step));
      if(next===row.scrollLeft)return;
      event.preventDefault();row.scrollLeft=next;
    };
    row.addEventListener('wheel',onWheel,{passive:false});
    return()=>row.removeEventListener('wheel',onWheel);
  },[]);
  useEffect(()=>{
    const reveal=()=>navigation.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView?.({block:'nearest',inline:'nearest'});
    reveal();window.addEventListener('resize',reveal);
    return()=>window.removeEventListener('resize',reveal);
  },[selected]);
  return <Dialog title="配置" layout="workspace" className="mf-configuration-dialog" onClose={onClose} dismissible={!busy} navigationRef={navigation} navigation={sections.map(([id,label])=><button type="button" aria-selected={selected===id} key={id} disabled={busy} onClick={()=>setSelected(id)}>{label}</button>)}>{content[selected]}</Dialog>;
}
