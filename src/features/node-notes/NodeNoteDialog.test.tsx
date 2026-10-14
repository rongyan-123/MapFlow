import { clearAccountNoteDrafts, noteDraftKey, readNoteDraft } from '../../domains/notes/noteDrafts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import NodeNoteDialog from './NodeNoteDialog';

afterEach(()=>{cleanup();vi.unstubAllGlobals();clearAccountNoteDrafts('account-1');clearAccountNoteDrafts('account-2');sessionStorage.clear();});

describe('NodeNoteDialog',()=>{
  it.each(['save', 'delete'] as const)('compares the latest remote note after a first-session %s conflict before an explicit save', async action => {
    const stored = { node_id:'n1', markdown:'旧理解', has_note:true, version:2, updated_at:null };
    const remote = { ...stored, markdown:'其他位置的新理解', version:3 };
    const localMarkdown = '我尚未保存的理解';
    const draftKey = noteDraftKey('account-1', 'e1', 'n1');
    expect(readNoteDraft(draftKey)).toBeNull();
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(stored)))
      .mockResolvedValueOnce(new Response(JSON.stringify({error:{code:'tree_note.version_conflict',message:'conflict'}}), {status:409}))
      .mockResolvedValueOnce(new Response(JSON.stringify(remote)))
      .mockResolvedValueOnce(new Response(JSON.stringify({...remote, markdown:localMarkdown, version:4})));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('confirm', vi.fn(() => true));
    render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><NodeNoteDialog accountId="account-1" libraryEntryId="e1" nodeId="n1" nodeTitle="事务" csrfToken="csrf" onClose={vi.fn()}/></QueryClientProvider>);
    const input = await screen.findByRole('textbox', {name:'Markdown 笔记'});
    fireEvent.change(input, {target:{value:localMarkdown}});
    const draftBeforeConflict = readNoteDraft(draftKey);
    await userEvent.click(screen.getByRole('button', {name:action === 'save' ? '保存笔记' : '删除笔记'}));
    await screen.findByText(/你的草稿已保留，请核对新版本后保存/);
    await screen.findByText('版本 3');
    expect(input).toHaveValue(localMarkdown);
    expect(readNoteDraft(draftKey)).toEqual(draftBeforeConflict);
    const comparison = await screen.findByText('服务器笔记有更新，展开核对');
    await userEvent.click(comparison);
    expect(comparison.closest('details')).toHaveAttribute('open');
    expect(comparison.closest('details')).toHaveTextContent(remote.markdown);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'PUT' || options?.method === 'DELETE')).toHaveLength(1);
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual(action === 'save'
      ? {markdown:localMarkdown, expectedVersion:2} : {expectedVersion:2});
    await userEvent.click(screen.getByRole('button', {name:'保存笔记'}));
    await screen.findByText('笔记已保存');
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[3][1]?.method).toBe('PUT');
    expect(JSON.parse(String(fetchMock.mock.calls[3][1]?.body))).toEqual({markdown:localMarkdown, expectedVersion:3});
    expect(input).toHaveValue(localMarkdown);
    expect(readNoteDraft(draftKey)).toBeNull();
    expect(screen.queryByText('服务器笔记有更新，展开核对')).not.toBeInTheDocument();
  });
  it('does not replace a newer saved version with a delayed receipt from a previous editor', async () => {
    const stored = { node_id:'n1', markdown:'旧理解', has_note:true, version:2, updated_at:null };
    let finishSave!: (response:Response) => void;
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockImplementation((_url, options) => options?.method === 'PUT'
      ? new Promise(resolve => { finishSave = resolve; }) : Promise.resolve(new Response(JSON.stringify(stored)))));
    const client = new QueryClient({ defaultOptions:{queries:{retry:false}} });
    const view = () => <QueryClientProvider client={client}><NodeNoteDialog accountId="account-1" libraryEntryId="e1" nodeId="n1" nodeTitle="事务" csrfToken="csrf" onClose={vi.fn()}/></QueryClientProvider>;
    const first=render(view());
    fireEvent.change(await screen.findByRole('textbox', {name:'Markdown 笔记'}), {target:{value:'第一次编辑'}});
    await userEvent.click(screen.getByRole('button', {name:'保存笔记'}));
    await waitFor(()=>expect(finishSave).toBeDefined()); first.unmount();
    const key=['me','account-1','node-note','e1','n1'];
    client.setQueryData(key,{...stored,markdown:'后来已保存的理解',version:4});
    finishSave(new Response(JSON.stringify({...stored,markdown:'第一次编辑',version:3})));
    await waitFor(()=>expect(client.isMutating()).toBe(0));
    expect(client.getQueryData(key)).toMatchObject({version:4,markdown:'后来已保存的理解'});
  });
  it('keeps a newer draft when a deletion receipt arrives after navigation', async () => {
    const stored = { node_id:'n1', markdown:'旧理解', has_note:true, version:2, updated_at:null };
    let finishDelete!: (response:Response) => void;
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const fetchMock = vi.fn<typeof fetch>().mockImplementation((_url, options) => options?.method === 'DELETE'
      ? new Promise(resolve => { finishDelete = resolve; }) : Promise.resolve(new Response(JSON.stringify(stored))));
    vi.stubGlobal('fetch', fetchMock);
    const client = new QueryClient({ defaultOptions:{queries:{retry:false}} });
    const view = () => <QueryClientProvider client={client}><NodeNoteDialog accountId="account-1" libraryEntryId="e1" nodeId="n1" nodeTitle="事务" csrfToken="csrf" onClose={vi.fn()}/></QueryClientProvider>;
    const first=render(view()); await screen.findByRole('textbox', { name:'Markdown 笔记' });
    await userEvent.click(screen.getByRole('button', { name:'删除笔记' }));
    await waitFor(() => expect(finishDelete).toBeDefined()); first.unmount();
    const second=render(view()); fireEvent.change(await screen.findByRole('textbox', {name:'Markdown 笔记'}), {target:{value:'回来后新写的草稿'}});
    finishDelete(new Response(JSON.stringify({...stored,markdown:'',has_note:false,version:3})));
    await waitFor(() => expect(client.getQueryData(['me','account-1','node-note','e1','n1'])).toMatchObject({version:3}));
    second.unmount(); render(view());
    expect(await screen.findByRole('textbox',{name:'Markdown 笔记'})).toHaveValue('回来后新写的草稿');
    vi.restoreAllMocks();
  });
  it('recovers an owned draft when a save fails after leaving the page', async () => {
    let rejectSave!: (error: Error) => void;
    const stored = { node_id:'n1', markdown:'旧理解', has_note:true, version:2, updated_at:null };
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify(stored)))
      .mockImplementationOnce(() => new Promise((_, reject) => { rejectSave = reject; }))
      .mockImplementation(() => Promise.resolve(new Response(JSON.stringify(stored))));
    vi.stubGlobal('fetch', fetchMock);
    const client = new QueryClient({ defaultOptions:{queries:{retry:false}} });
    const view = (accountId = 'account-1') => <QueryClientProvider client={client}><NodeNoteDialog accountId={accountId} libraryEntryId="e1" nodeId="n1" nodeTitle="事务" csrfToken="csrf" onClose={vi.fn()}/></QueryClientProvider>;
    const first = render(view()); const input = await screen.findByRole('textbox', { name:'Markdown 笔记' });
    fireEvent.change(input, { target:{ value:'离开页面后还应保留的理解' } });
    await userEvent.click(screen.getByRole('button', { name:'保存笔记' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    first.unmount(); rejectSave(new Error('private.example database failure'));
    render(view());
    expect(await screen.findByRole('textbox', { name:'Markdown 笔记' })).toHaveValue('离开页面后还应保留的理解');
    expect(screen.getByText(/已恢复未保存的笔记草稿/)).toBeInTheDocument();
    cleanup(); render(view('account-2'));
    expect(await screen.findByRole('textbox', { name:'Markdown 笔记' })).toHaveValue('旧理解');
  });
  it('keeps a pending note save mounted until its receipt arrives',async()=>{
    let finish!: (response: Response)=>void;
    const fetchMock=vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify({node_id:'n1',markdown:'旧理解',has_note:true,version:2,updated_at:null})))
      .mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
    vi.stubGlobal('fetch',fetchMock);const close=vi.fn();
    render(<QueryClientProvider client={new QueryClient()}><NodeNoteDialog accountId="account-1" libraryEntryId="e1" nodeId="n1" nodeTitle="事务" csrfToken="csrf" onClose={close}/></QueryClientProvider>);
    const input=await screen.findByRole('textbox',{name:'Markdown 笔记'});
    await userEvent.clear(input);await userEvent.type(input,'新理解');await userEvent.click(screen.getByRole('button',{name:'保存笔记'}));
    await waitFor(()=>expect(fetchMock).toHaveBeenCalledTimes(2));
    await userEvent.click(screen.getByRole('button',{name:'关闭'}));
    fireEvent.mouseDown(screen.getByRole('presentation'));
    expect(close).not.toHaveBeenCalled();expect(input).toBeDisabled();
    finish(new Response(JSON.stringify({node_id:'n1',markdown:'新理解',has_note:true,version:3,updated_at:null})));
    await screen.findByText('笔记已保存');await userEvent.click(screen.getByRole('button',{name:'关闭'}));
    expect(close).toHaveBeenCalledTimes(1);
  });
  it('preserves the typed draft when a version conflict reloads the remote note',async()=>{
    const fetchMock=vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({node_id:'n1',markdown:'旧理解',has_note:true,version:2,updated_at:null})))
      .mockResolvedValueOnce(new Response(JSON.stringify({error:{code:'tree_note.version_conflict',message:'conflict'}}),{status:409}))
      .mockResolvedValueOnce(new Response(JSON.stringify({node_id:'n1',markdown:'其他位置的新理解',has_note:true,version:3,updated_at:null})));
    vi.stubGlobal('fetch',fetchMock);
    render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><NodeNoteDialog accountId="account-1" libraryEntryId="e1" nodeId="n1" nodeTitle="事务" csrfToken="csrf" onClose={vi.fn()}/></QueryClientProvider>);
    const input=await screen.findByRole('textbox',{name:'Markdown 笔记'});
    await userEvent.clear(input);await userEvent.type(input,'我尚未保存的理解');await userEvent.click(screen.getByRole('button',{name:'保存笔记'}));
    await screen.findByText('版本 3');expect(input).toHaveValue('我尚未保存的理解');
  });
  it('loads and replaces the whole note at the returned version',async()=>{
    const fetchMock=vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({node_id:'n1',markdown:'旧理解',has_note:true,version:2,updated_at:null}),{status:200,headers:{'content-type':'application/json'}}))
      .mockResolvedValueOnce(new Response(JSON.stringify({node_id:'n1',markdown:'精炼后的理解',has_note:true,version:3,updated_at:null}),{status:200,headers:{'content-type':'application/json'}}));
    vi.stubGlobal('fetch',fetchMock);
    render(<QueryClientProvider client={new QueryClient()}><NodeNoteDialog accountId="account-1" libraryEntryId="e1" nodeId="n1" nodeTitle="事务" csrfToken="csrf" onClose={vi.fn()}/></QueryClientProvider>);
    const input=await screen.findByRole('textbox',{name:'Markdown 笔记'});
    await userEvent.clear(input); await userEvent.type(input,'精炼后的理解');
    await userEvent.click(screen.getByRole('button',{name:'保存笔记'}));
    await vi.waitFor(()=>expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body))).toEqual({markdown:'精炼后的理解',expectedVersion:2});
  });
});
