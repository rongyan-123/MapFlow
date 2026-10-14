import {request,readFailure} from './http';
import {PublicUiError} from '../lib/publicErrors';
import type {UserModelProfile} from '../domains/models/modelCatalog';
class ModelCatalogError extends PublicUiError{constructor(readonly status:number,readonly code:string,message:string){super(message);}}
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
export async function readUserModelCatalog():Promise<UserModelProfile[]>{
  const response=await request('/api/model-catalog/byok');if(!response.ok){const failure=await readFailure(response);throw new ModelCatalogError(failure.status,failure.code,failure.message);}
  const invalid=()=>new ModelCatalogError(502,'model_catalog.invalid_response','模型目录响应无效，请重新读取。');
  let catalog:unknown;try{catalog=await response.json();}catch{throw invalid();}if(!Array.isArray(catalog))throw invalid();
  return catalog.map(profile=>{if(!object(profile)||typeof profile.id!=='string'||!profile.id.trim()||profile.id.length>256||typeof profile.provider!=='string'||!profile.provider.trim()||!Number.isSafeInteger(profile.contextWindow)||Number(profile.contextWindow)<1||typeof profile.baseUrl!=='string'||!profile.baseUrl.trim()||!Array.isArray(profile.settings))throw invalid();const settings=profile.settings.map(setting=>{if(!object(setting)||typeof setting.name!=='string'||!setting.name.trim()||!['switch','select'].includes(String(setting.kind))||!Array.isArray(setting.options)||!setting.options.every(option=>typeof option==='string'))throw invalid();return {name:setting.name,kind:setting.kind as 'switch'|'select',options:setting.options as string[]};});return {id:profile.id,provider:profile.provider,contextWindow:Number(profile.contextWindow),baseUrl:profile.baseUrl,settings};});
}
