import {useState} from 'react';
import {agentGuide} from '../../domains/support/agentGuide';
import {Dialog} from '../Dialog';
import {Button} from '../Button';
export default function AgentGuideDialog({onClose,initialSectionId='quick-start'}:{onClose:()=>void;initialSectionId?:string}){
  const [selected,setSelected]=useState(initialSectionId);const [copied,setCopied]=useState('');const section=agentGuide.find(item=>item.id===selected)??agentGuide[3];const groups=[...new Set(agentGuide.map(item=>item.group))];
  return <Dialog title="Agent 接入教程" layout="workspace" onClose={onClose}><div className="mf-guide-layout"><nav aria-label="接入教程目录">{groups.map((group,index)=><section key={group} data-testid={`mcp-guide-group-${['understand','connect','manage','account'][index]}`}><h3>{group}</h3>{agentGuide.filter(item=>item.group===group).map(item=><button type="button" key={item.id} aria-current={item.id===section.id?'page':undefined} onClick={()=>{setSelected(item.id);setCopied('');}}>{item.title}</button>)}</section>)}</nav><article className="mf-stack"><p className="mf-eyebrow">{section.group}</p><h2>{section.title}</h2>{section.paragraphs.map(paragraph=><p key={paragraph} className="mf-small">{paragraph}</p>)}{section.command&&<div className="mf-command"><code>{section.command}</code><Button onClick={()=>void navigator.clipboard.writeText(section.command!).then(()=>setCopied('命令已复制')).catch(()=>setCopied('请选中命令手动复制'))}>复制命令</Button>{copied&&<span role="status">{copied}</span>}</div>}</article></div></Dialog>;
}
