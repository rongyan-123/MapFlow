import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import NodeNoteDialog from './NodeNoteDialog';

afterEach(()=>{cleanup();vi.unstubAllGlobals();});

describe('NodeNoteDialog',()=>{
  it('keeps a pending note save mounted until its receipt arrives',async()=>{
    let finish!: (response: Response)=>void;
    const fetchMock=vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify({node_id:'n1',markdown:'旧理解',has_note:true,version:2,updated_at:null})))
      .mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
    vi.stubGlobal('fetch',fetchMock);const close=vi.fn();
    render(<QueryClientProvider client={new QueryClient()}><NodeNoteDialog libraryEntryId="e1" nodeId="n1" nodeTitle="事务" csrfToken="csrf" onClose={close}/></QueryClientProvider>);
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
    render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><NodeNoteDialog libraryEntryId="e1" nodeId="n1" nodeTitle="事务" csrfToken="csrf" onClose={vi.fn()}/></QueryClientProvider>);
    const input=await screen.findByRole('textbox',{name:'Markdown 笔记'});
    await userEvent.clear(input);await userEvent.type(input,'我尚未保存的理解');await userEvent.click(screen.getByRole('button',{name:'保存笔记'}));
    await screen.findByText('版本 3');expect(input).toHaveValue('我尚未保存的理解');
  });
  it('loads and replaces the whole note at the returned version',async()=>{
    const fetchMock=vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({node_id:'n1',markdown:'旧理解',has_note:true,version:2,updated_at:null}),{status:200,headers:{'content-type':'application/json'}}))
      .mockResolvedValueOnce(new Response(JSON.stringify({node_id:'n1',markdown:'精炼后的理解',has_note:true,version:3,updated_at:null}),{status:200,headers:{'content-type':'application/json'}}));
    vi.stubGlobal('fetch',fetchMock);
    render(<QueryClientProvider client={new QueryClient()}><NodeNoteDialog libraryEntryId="e1" nodeId="n1" nodeTitle="事务" csrfToken="csrf" onClose={vi.fn()}/></QueryClientProvider>);
    const input=await screen.findByRole('textbox',{name:'Markdown 笔记'});
    await userEvent.clear(input); await userEvent.type(input,'精炼后的理解');
    await userEvent.click(screen.getByRole('button',{name:'保存笔记'}));
    await vi.waitFor(()=>expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body))).toEqual({markdown:'精炼后的理解',expectedVersion:2});
  });
});
