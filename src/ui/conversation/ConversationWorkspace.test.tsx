import { useState } from 'react';
import { render,screen,fireEvent } from '@testing-library/react';
import { expect,it,vi } from 'vitest';
import { ConversationWorkspace } from './ConversationWorkspace';
import { Dialog } from '../Dialog';
function Controller({send=vi.fn()}:{send?:()=>void}){const [draft,setDraft]=useState('');const [config,setConfig]=useState(false);return <><ConversationWorkspace scene="management" title="全局助手" draft={draft} onDraftChange={setDraft} onSend={send} modelLabel="实际模型" onConfigure={()=>setConfig(true)} onModelConfigure={()=>setConfig(true)} onNew={()=>{}} onHistory={()=>{}} onCanvas={()=>{}} welcome />{config && <Dialog title="配置" layout="workspace" onClose={()=>setConfig(false)}>模型接入</Dialog>}</>;}
it('fills an editable prompt from a guide without starting a paid execution',()=>{
  const send=vi.fn();render(<Controller send={send} />);
  fireEvent.click(screen.getByRole('button',{name:'创建一张学习地图'}));
  expect(screen.getByRole('textbox',{name:'消息'})).toHaveValue('帮我创建一张学习地图，我想学：');
  expect(send).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'发送'}));expect(send).toHaveBeenCalledTimes(1);
});
it('keeps the draft when configuration is opened and closed',()=>{
  render(<Controller />);fireEvent.change(screen.getByRole('textbox',{name:'消息'}),{target:{value:'尚未发送的学习目标'}});
  fireEvent.click(screen.getByRole('button',{name:'配置'}));fireEvent.click(screen.getByRole('button',{name:'关闭'}));
  expect(screen.getByRole('textbox',{name:'消息'})).toHaveValue('尚未发送的学习目标');
});
it('offers guidance as an entry screen without inserting fictional chat messages',()=>{
  render(<Controller />);expect(screen.getAllByRole('button').filter(button=>button.dataset.guide)).toHaveLength(4);
  expect(screen.getByRole('log',{name:'对话消息'})).toBeEmptyDOMElement();
});
it('makes secondary actions available in one menu and keeps the composer draft',()=>{
  render(<Controller />);fireEvent.change(screen.getByRole('textbox',{name:'消息'}),{target:{value:'还没发送'}});
  fireEvent.click(screen.getByRole('button',{name:'更多聊天操作'}));expect(screen.getByRole('dialog',{name:'聊天操作'})).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'查看会话历史'}));expect(screen.queryByRole('dialog')).not.toBeInTheDocument();expect(screen.getByRole('textbox',{name:'消息'})).toHaveValue('还没发送');
});
