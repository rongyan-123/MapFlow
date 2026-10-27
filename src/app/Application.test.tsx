import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {render,screen,fireEvent,waitFor,act,within} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {IdentityProvider,SESSION_QUERY_KEY} from '../domains/identity/IdentityContext';
import Application from './Application';
afterEach(()=>{vi.unstubAllGlobals();localStorage.clear();window.history.replaceState({},'','/');});
const tree={id:'11111111-1111-4111-8111-111111111111',topic:'NestJS',title:'记住的个人地图',description:null,difficulty_level:'intermediate',total_nodes:1};
const node={id:'remembered-node',tree_id:tree.id,title:'记住的学习节点',description:null,icon:'box',category:'基础',difficulty:1,estimated_minutes:20,depth_level:0,position_x:0,position_y:0,order_in_level:0,learning_objectives:null,key_concepts:null,recommended_depth:'Understand',depth_rationale:'理解模块边界',observable_evidence:'可以解释模块结构'};
function open(address:string,loggedIn=false,ownedEntries:string[]=[]){vi.stubGlobal('ResizeObserver',class{observe(){}unobserve(){}disconnect(){}});window.history.replaceState({},'',address);const requests:Array<[string,RequestInit|undefined]>=[];vi.stubGlobal('fetch',async(path:string,options?:RequestInit)=>{requests.push([path,options]);if(path==='/api/auth/login')return new Response(JSON.stringify({account:{playerId:'a',username:'用户',status:'active',isAdmin:false},csrfToken:'csrf'}));if(path==='/api/me/tree-library')return new Response(JSON.stringify({entries:ownedEntries.map(library_entry_id=>({library_entry_id,tree,completed_nodes:0}))}));if(ownedEntries.some(id=>path==='/api/me/tree-library/'+id))return new Response(JSON.stringify({library_entry_id:path.split('/').pop(),view_mode:'personal',graph:{tree,nodes:[node],edges:[]},completed_node_ids:[]}));if(path==='/api/auth/me')return new Response(JSON.stringify({account:null}),{status:401});return new Response('{}',{status:503});});const client=new QueryClient({defaultOptions:{queries:{retry:false}}});client.setQueryData(SESSION_QUERY_KEY,loggedIn?{account:{playerId:'a',username:'用户',status:'active',isAdmin:false},csrfToken:'csrf'}:null);render(<QueryClientProvider client={client}><IdentityProvider><Application /></IdentityProvider></QueryClientProvider>);return requests;}
it('holds a private deep link behind login without querying personal records',()=>{const requests=open('/maps?entry=private-map');expect(screen.getByRole('textbox',{name:'用户名'})).toBeVisible();expect(requests.some(([path])=>path==='/api/me/tree-library')).toBe(false);});
it('retains the requested deep link after successful login',async()=>{open('/maps?entry=private-map');fireEvent.change(screen.getByRole('textbox',{name:'用户名'}),{target:{value:'用户'}});fireEvent.change(screen.getByLabelText('密码'),{target:{value:'secure-password'}});fireEvent.click(screen.getByRole('button',{name:'登录'}));await screen.findByText('当前账号找不到这张地图。',{}, {timeout:5000});expect(window.location.pathname+window.location.search).toBe('/maps?entry=private-map');});
it('restores the account-owned legacy console view and responds to browser navigation',async()=>{localStorage.setItem('mapflow.console.state.v1.a',JSON.stringify({version:1,view:'personal'}));open('/console',true);await screen.findByText('第一张地图，从你的目标开始。');act(()=>{window.history.pushState({},'','/settings');window.dispatchEvent(new PopStateEvent('popstate'));});await screen.findByText('让学习，合你的习惯。');expect(screen.getAllByRole('banner')).toHaveLength(1);});
it('opens the anonymous marketing page',()=>{open('/?marketing=1');expect(screen.getByRole('heading',{level:1})).toBeVisible();expect(screen.getByRole('button',{name:/打开我的学习地图/})).toBeVisible();});
it('opens the Skill and MCP installation guide directly from the workspace',async()=>{
  open('/settings',true);
  await screen.findByText('让学习，合你的习惯。');
  fireEvent.click(screen.getByRole('button',{name:'Skill / MCP 接入'}));
  const guide=within(screen.getByRole('dialog',{name:'Agent 接入教程'}));
  fireEvent.click(guide.getByRole('button',{name:'安装 Skill'}));
  expect(guide.getByText('npx skills add rongyan-123/MapFlow --skill mapflow-mcp --global')).toBeVisible();
  fireEvent.click(guide.getByRole('button',{name:'配置 MCP'}));
  expect(guide.getByText('npx @mapflow-publish/mcp')).toBeVisible();
  fireEvent.click(guide.getByRole('button',{name:'关闭'}));
  expect(window.location.pathname).toBe('/settings');
});
it('reaches the same guide from the mobile workspace drawer and closes the drawer',async()=>{
  vi.stubGlobal('innerWidth',390);
  open('/settings',true);
  await screen.findByText('让学习，合你的习惯。');
  fireEvent.click(screen.getByRole('button',{name:'打开功能菜单'}));
  fireEvent.click(within(screen.getByRole('dialog',{name:'MapFlow'})).getByRole('button',{name:'Skill / MCP 接入'}));
  expect(screen.queryByRole('dialog',{name:'MapFlow'})).not.toBeInTheDocument();
  expect(screen.getByRole('dialog',{name:'Agent 接入教程'})).toBeVisible();
  expect(window.location.pathname).toBe('/settings');
});
it('restores the current account legacy map and node after server ownership is confirmed',async()=>{
  localStorage.setItem('mapflow.console.state.v1.a',JSON.stringify({version:1,view:'personal',selectedLibraryEntryId:'owned-entry',selectedNodeId:node.id,layoutMode:'blocks'}));
  open('/console',true,['owned-entry']);const details=await screen.findByRole('complementary',{name:'节点详情'});
  expect(within(details).getByRole('heading',{name:node.title,level:2})).toBeVisible();
  expect(screen.getByRole('button',{name:'按块排序'})).toHaveAttribute('aria-pressed','true');
});
it('rejects an unowned remembered map without fetching its detail',async()=>{
  localStorage.setItem('mapflow.console.state.v1.a',JSON.stringify({version:1,view:'personal',selectedLibraryEntryId:'foreign-entry',selectedNodeId:node.id}));
  const requests=open('/console',true);await screen.findByText('当前账号找不到这张地图。');expect(requests.some(([path])=>path==='/api/me/tree-library/foreign-entry')).toBe(false);
});
it('does not restore another account legacy selection',async()=>{
  localStorage.setItem('mapflow.console.state.v1.other-account',JSON.stringify({version:1,view:'personal',selectedLibraryEntryId:'foreign-entry'}));
  open('/console',true);await screen.findByRole('heading',{name:'找一张地图，开始探索。'});
});
it('puts a restored owned learning area into the address so the mobile chat shell is selected',async()=>{
  const area={areaId:'owned-area',libraryEntryId:'owned-area',title:'记住的学习区',available:true,createdAt:'2026-10-14T10:00:00Z'};
  window.history.replaceState({},'','/learning');localStorage.setItem('mapflow.learning.area.v1.a',area.areaId);
  vi.stubGlobal('fetch',async(path:string)=>new Response(JSON.stringify(path.endsWith('/learning-areas')?{areas:[area]}:path==='/api/me/tree-library'?{entries:[]}:path.endsWith('/characters')?{characters:[]}:path.includes('/learning-areas/')?{conversations:[],bootstrapState:'cleared'}:{})));
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});client.setQueryData(SESSION_QUERY_KEY,{account:{playerId:'a',username:'用户',status:'active',isAdmin:false},csrfToken:'csrf'});
  render(<QueryClientProvider client={client}><IdentityProvider><Application /></IdentityProvider></QueryClientProvider>);
  await screen.findByRole('combobox',{name:'切换学习区'});await waitFor(()=>expect(window.location.pathname+window.location.search).toBe('/learning?area=owned-area'));
  const back=screen.getByRole('button',{name:'返回学习区列表'});
  expect(screen.getByRole('heading',{level:1,name:'学习聊天'}).compareDocumentPosition(back)&Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  fireEvent.click(back);
  await screen.findByRole('button',{name:'进入学习区'});
  expect(window.location.pathname+window.location.search).toBe('/learning');
  expect(screen.queryByRole('combobox',{name:'切换学习区'})).not.toBeInTheDocument();
});
