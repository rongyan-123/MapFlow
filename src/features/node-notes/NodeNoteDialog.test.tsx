import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import NodeNoteDialog from './NodeNoteDialog';

afterEach(()=>vi.unstubAllGlobals());

describe('NodeNoteDialog',()=>{
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
