import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {IdentityProvider,SESSION_QUERY_KEY} from '../domains/identity/IdentityContext';
import Application from './Application';

const tree={id:'11111111-1111-4111-8111-111111111111',topic:'Python',title:'Python 入门学习路线',description:'先学语法，再用小项目练习。',difficulty_level:'beginner',total_nodes:1};
const node={id:'python-basics',tree_id:tree.id,title:'Python 基础语法',description:'理解变量和基本类型',icon:'code',category:'基础',difficulty:1,estimated_minutes:20,depth_level:0,position_x:0,position_y:0,order_in_level:0,learning_objectives:null,key_concepts:null,recommended_depth:'Understand',depth_rationale:'能解释变量',observable_evidence:'完成小练习'};

afterEach(()=>{vi.unstubAllGlobals();localStorage.clear();window.history.replaceState({},'','/');});

function open(address:string){
  window.history.replaceState({},'',address);
  vi.stubGlobal('ResizeObserver',class{observe(){}unobserve(){}disconnect(){}});
  const requests:Array<{path:string;method:string}>=[];
  vi.stubGlobal('fetch',async(path:string,options?:RequestInit)=>{
    requests.push({path,method:options?.method??'GET'});
    if(path.startsWith('/api/trees/public?'))return Response.json({trees:[tree],attributions:{},next_cursor:null});
    if(path===`/api/trees/public/${tree.id}`)return Response.json({view_mode:'showcase',graph:{tree,nodes:[node],edges:[]}});
    return Response.json({error:{code:'identity.unauthenticated'}},{status:401});
  });
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  client.setQueryData(SESSION_QUERY_KEY,null);
  render(<QueryClientProvider client={client}><IdentityProvider><Application /></IdentityProvider></QueryClientProvider>);
  return requests;
}

it('lets a visitor browse the public library without asking for private data',async()=>{
  const requests=open('/library');
  await screen.findByRole('heading',{name:'找一张地图，开始探索。'},{timeout:5000});
  expect(await screen.findByText(tree.title)).toBeVisible();
  expect(screen.queryByRole('textbox',{name:'用户名'})).not.toBeInTheDocument();
  expect(requests.some(request=>request.path.startsWith('/api/me/'))).toBe(false);
},10000);

it('keeps a public map readable and asks the visitor to log in before adding it',async()=>{
  const destination=`/library?tree=${tree.id}&node=${node.id}`;
  const requests=open(destination);
  const add=await screen.findByRole('button',{name:'登录后加入我的地图'});
  await waitFor(()=>expect(add).not.toBeDisabled());
  expect(await screen.findByRole('heading',{level:2,name:node.title})).toBeVisible();
  fireEvent.click(add);
  await screen.findByRole('textbox',{name:'用户名'});
  expect(new URLSearchParams(window.location.search).get('next')).toBe(destination);
  expect(requests.some(request=>request.method!=='GET')).toBe(false);
  expect(requests.some(request=>request.path.startsWith('/api/me/'))).toBe(false);
});
