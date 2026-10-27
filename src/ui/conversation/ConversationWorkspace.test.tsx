import { useState } from 'react';
import { render,screen,fireEvent,within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect,it,vi } from 'vitest';
import { ConversationWorkspace, type ConversationWorkspaceProps } from './ConversationWorkspace';
import { Dialog } from '../Dialog';
function Controller({send=vi.fn(),scene='management'}:{send?:()=>void;scene?:'management'|'tavern'}){const [draft,setDraft]=useState('');const [config,setConfig]=useState(false);return <><ConversationWorkspace scene={scene} title={scene==='tavern'?'学习助手':'全局助手'} draft={draft} onDraftChange={setDraft} onSend={send} modelLabel="实际模型" onConfigure={()=>setConfig(true)} onModelConfigure={()=>setConfig(true)} onNew={()=>{}} onHistory={()=>{}} onCanvas={()=>{}} welcome />{config && <Dialog title="配置" layout="workspace" onClose={()=>setConfig(false)}>模型接入</Dialog>}</>;}

it('keeps independently adjusted map and canvas widths when switching panels', () => {
  vi.stubGlobal('innerWidth', 1440);
  const bounds = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return new DOMRect(0, 0, parseFloat(this.style.getPropertyValue('--panel-width')) || 1200, 800);
  });
  const resizeKey = 'mapflow.layout.canvas.resize-test';
  localStorage.setItem(resizeKey, '600');
  localStorage.setItem(`${resizeKey}.map`, '500');
  const props: ConversationWorkspaceProps = { scene: 'learning', title: '学习聊天', draft: '稍后发送', onDraftChange: () => {}, onSend: () => {}, modelLabel: '测试模型', onConfigure: () => {}, onModelConfigure: () => {}, onNew: () => {}, onHistory: () => {}, onCanvas: () => {}, resizeKey };
  try {
    const view = render(<ConversationWorkspace {...props} sidePaneKind="map" sidePane={<div>学习地图</div>} />);
    const mapResize = screen.getByRole('separator', { name: '调整地图与聊天宽度' });
    expect(mapResize).toHaveAttribute('aria-valuenow', '500');
    fireEvent.keyDown(mapResize, { key: 'ArrowRight' });
    expect(localStorage.getItem(`${resizeKey}.map`)).toBe('520');
    view.rerender(<ConversationWorkspace {...props} sidePaneKind="canvas" sidePaneWide={false} sidePane={<div>教学画布</div>} />);
    expect(screen.getByRole('separator', { name: '调整画布与聊天宽度' })).toHaveAttribute('aria-valuenow', '600');
    expect(localStorage.getItem(resizeKey)).toBe('600');
    view.rerender(<ConversationWorkspace {...props} sidePaneKind="map" sidePane={<div>学习地图</div>} />);
    expect(screen.getByRole('separator', { name: '调整地图与聊天宽度' })).toHaveAttribute('aria-valuenow', '520');
    view.rerender(<ConversationWorkspace {...props} sidePaneKind="canvas" sidePaneWide={false} sidePane={<div>教学画布</div>} />);
    expect(screen.getByRole('separator', { name: '调整画布与聊天宽度' })).toHaveAttribute('aria-valuenow', '600');
    view.rerender(<ConversationWorkspace {...props} sidePaneKind="canvas" sidePaneWide sidePane={<div>教学画布</div>} />);
    expect(localStorage.getItem(resizeKey)).toBeNull();
    expect(localStorage.getItem(`${resizeKey}.map`)).toBe('520');
    expect(screen.getByRole('textbox', { name: '消息' })).toHaveValue('稍后发送');
  } finally {
    localStorage.clear();
    bounds.mockRestore();
    vi.unstubAllGlobals();
  }
});

it('酒馆从更多面板进入聊天配置，关闭后保留草稿并返回更多按钮',async()=>{
  const user=userEvent.setup();
  const send=vi.fn();
  render(<Controller scene="tavern" send={send} />);
  await user.type(screen.getByRole('textbox',{name:'消息'}),'尚未发送的故事');
  const more=screen.getByRole('button',{name:'更多聊天操作'});
  await user.click(more);
  await user.click(within(screen.getByRole('dialog',{name:'聊天操作'})).getByRole('button',{name:/聊天配置/}));

  expect(screen.queryByRole('dialog',{name:'聊天操作'})).not.toBeInTheDocument();
  expect(screen.getByRole('dialog',{name:'配置'})).toBeVisible();
  await user.click(screen.getByRole('button',{name:'关闭'}));
  expect(screen.getByRole('textbox',{name:'消息'})).toHaveValue('尚未发送的故事');
  expect(more).toHaveFocus();
  expect(send).not.toHaveBeenCalled();
});

it('酒馆更多按钮报告开关状态，键盘和遮罩关闭后保留草稿与焦点',async()=>{
  const user=userEvent.setup();
  render(<Controller scene="tavern" />);
  fireEvent.change(screen.getByRole('textbox',{name:'消息'}),{target:{value:'稍后继续聊'}});
  const more=screen.getByRole('button',{name:'更多聊天操作'});
  expect(more).toHaveAttribute('aria-expanded','false');
  await user.click(more);
  expect(more).toHaveAttribute('aria-expanded','true');
  const menu=screen.getByRole('dialog',{name:'聊天操作'});
  within(menu).getByRole('button',{name:/聊天配置/}).focus();
  await user.tab();
  expect(within(menu).getByRole('button',{name:'关闭'})).toHaveFocus();
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(more).toHaveAttribute('aria-expanded','false');
  expect(more).toHaveFocus();
  await user.click(more);
  fireEvent.mouseDown(screen.getByRole('dialog',{name:'聊天操作'}).parentElement!);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(more).toHaveFocus();
  expect(screen.getByRole('textbox',{name:'消息'})).toHaveValue('稍后继续聊');
});
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
