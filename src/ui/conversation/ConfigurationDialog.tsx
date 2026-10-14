import { useState,type ReactNode } from 'react';
import { Dialog } from '../Dialog';
export type ConfigurationSection='overview'|'model'|'tools'|'profile'|'branches';
const sections:[ConfigurationSection,string][]=[['overview','角色与会话'],['model','模型接入'],['tools','技能树与工具'],['profile','会话设定'],['branches','历史与分支']];
export function ConfigurationDialog({content,onClose,busy=false,initialSection='overview'}:{content:Record<ConfigurationSection,ReactNode>;onClose:()=>void;busy?:boolean;initialSection?:ConfigurationSection}){
  const [selected,setSelected]=useState(initialSection);
  return <Dialog title="配置" layout="workspace" onClose={onClose} dismissible={!busy} navigation={sections.map(([id,label])=><button type="button" aria-selected={selected===id} key={id} disabled={busy} onClick={()=>setSelected(id)}>{label}</button>)}>{content[selected]}</Dialog>;
}
