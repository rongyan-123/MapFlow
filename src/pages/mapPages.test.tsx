import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { render,screen,fireEvent,waitFor } from '@testing-library/react';
import { afterEach,expect,it,vi } from 'vitest';
import { IdentityProvider,SESSION_QUERY_KEY } from '../domains/identity/IdentityContext';
import LibraryPage from './LibraryPage';
import MapsPage from './MapsPage';
afterEach(()=>vi.unstubAllGlobals());
const session={account:{playerId:'owner-a',username:'learner',status:'active',isAdmin:false},csrfToken:'csrf-a'};
const tree={id:'tree-real',topic:'CSV',title:'真实地图',description:'服务器提供的路线',difficulty_level:'入门',total_nodes:0};
function mount(page:React.ReactNode){const client=new QueryClient({defaultOptions:{queries:{retry:false}}});client.setQueryData(SESSION_QUERY_KEY,session);return render(<QueryClientProvider client={client}><IdentityProvider>{page}</IdentityProvider></QueryClientProvider>);}
it('shows the real public catalog before opening any map',async()=>{
  const paths:string[]=[];vi.stubGlobal('fetch',async(path:string)=>{paths.push(path);return path.startsWith('/api/trees') ? new Response(JSON.stringify({trees:[tree],attributions:{},next_cursor:null})):new Response('{}',{status:503});});
  const navigate=vi.fn();mount(<LibraryPage navigate={navigate} />);
  await screen.findByRole('heading',{name:'真实地图'});
  expect(paths).not.toContain('/api/trees/public/tree-real');
  expect(screen.queryByText('选择一张地图查看路线')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'查看地图 真实地图'}));
  expect(navigate).toHaveBeenCalledWith('/library?tree=tree-real');
});
it('shows a retry after a catalog error without inserting demonstration maps',async()=>{
  let attempts=0;vi.stubGlobal('fetch',async(path:string)=>path.startsWith('/api/trees') && ++attempts===1 ? new Response('{}',{status:503}):new Response(JSON.stringify({trees:[],attributions:{},next_cursor:null})));
  mount(<LibraryPage navigate={vi.fn()} />);
  await screen.findByRole('alert');fireEvent.click(screen.getByRole('button',{name:'重新读取书库'}));
  await screen.findByText('书库暂时没有公开地图。');expect(screen.queryByText('NestJS')).not.toBeInTheDocument();
});
it('checks the owned index before reading a personal deep link',async()=>{
  const paths:string[]=[];vi.stubGlobal('fetch',async(path:string)=>{paths.push(path);if(path==='/api/me/tree-library')return new Response(JSON.stringify({entries:[{library_entry_id:'entry-owned',tree,completed_nodes:0}]}));return new Response('{}',{status:503});});
  mount(<MapsPage entryId="entry-other" navigate={vi.fn()} />);
  await screen.findByText('当前账号找不到这张地图。');
  expect(paths).not.toContain('/api/me/tree-library/entry-other');
});
it('opens an owned deep link and does not read another default map',async()=>{
  const paths:string[]=[];vi.stubGlobal('fetch',async(path:string)=>{paths.push(path);if(path==='/api/me/tree-library')return new Response(JSON.stringify({entries:[{library_entry_id:'entry-old',tree:{...tree,title:'另一张地图'},completed_nodes:0},{library_entry_id:'entry-owned',tree,completed_nodes:0}]}));if(path==='/api/me/tree-library/entry-owned')return new Response(JSON.stringify({view_mode:'personal',library_entry_id:'entry-owned',graph:{tree,nodes:[],edges:[]},completed_node_ids:[]}));return new Response('{}',{status:503});});
  mount(<MapsPage entryId="entry-owned" navigate={vi.fn()} />);
  await waitFor(()=>expect(paths).toContain('/api/me/tree-library/entry-owned'));
  expect(paths).not.toContain('/api/me/tree-library/entry-old');
  await screen.findByText('这张地图还没有节点。');
});
it('adds a public map using the server receipt and navigates to its owned copy',async()=>{
  let written:RequestInit|undefined;vi.stubGlobal('fetch',async(path:string,options?:RequestInit)=>{
    if(path==='/api/trees/public/tree-real')return new Response(JSON.stringify({view_mode:'showcase',graph:{tree,nodes:[],edges:[]},attribution:null}));
    if(path.startsWith('/api/trees'))return new Response(JSON.stringify({trees:[tree],attributions:{},next_cursor:null}));
    if(path==='/api/me/tree-library'){written=options;return new Response(JSON.stringify({library_entry_id:'entry-created',tree_id:'tree-private'}));}
    return new Response('{}',{status:503});
  });
  const navigate=vi.fn();mount(<LibraryPage navigate={navigate} treeId="tree-real" />);
  await screen.findByText('这张地图还没有节点。');fireEvent.click(screen.getByRole('button',{name:'加入我的地图'}));
  await waitFor(()=>expect(navigate).toHaveBeenCalledWith('/maps?entry=entry-created'));
  expect(written).toMatchObject({method:'POST',body:JSON.stringify({treeId:'tree-real'}),headers:expect.objectContaining({'X-CSRF-Token':'csrf-a'})});
});
