import type {LegacyConsoleState} from './routes';
function storedId(value:unknown):string|undefined{return typeof value==='string'&&value.trim()&&value.length<=128&&!value.includes('\0')?value:undefined;}
export function readLegacyConsoleState(accountId?:string):LegacyConsoleState|undefined{
  if(!accountId)return;
  try{
    const saved=JSON.parse(localStorage.getItem(`mapflow.console.state.v1.${accountId}`)??'null');
    if(saved?.version!==1||!['public','personal','learning'].includes(saved.view))return;
    return {version:1,view:saved.view,selectedLibraryEntryId:storedId(saved.selectedLibraryEntryId),selectedPublicTreeId:storedId(saved.selectedPublicTreeId),selectedNodeId:storedId(saved.selectedNodeId),layoutMode:saved.layoutMode==='blocks'?'blocks':'relationship'};
  }catch{return;}
}
