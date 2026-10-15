import {request,readFailure} from './http';
import {PublicUiError} from '../lib/publicErrors';

export const knowledgeCategories=['网站介绍','使用指南','学习理念','路线规划','常见问题'] as const;
export interface KnowledgeDraft {
  title:string;markdown:string;aliases:string[];keywords:string[];category:string;sourceNote:string;expectedVersion?:number;
}
export interface KnowledgeArticle extends KnowledgeDraft {
  articleId:string;version:number;draftRevisionId:string;publishedRevisionId:string|null;targetRevisionId:string|null;
  publicationGeneration:number;indexStatus:string;indexError:string|null;updatedAt:string;
}
export interface KnowledgeRevision extends KnowledgeDraft {
  revisionId:string;revisionNumber:number;contentDigest:string;createdAt:string;publishedBefore:boolean;
}
export interface KnowledgeReference {
  sourceId:string;articleId:string;revisionId:string;revisionNumber:number;title:string;sectionPath:string[];excerpt:string;ordinal:number;
}
export interface KnowledgeSourcePage {
  sourceId:string;articleId:string;revisionNumber:number;title:string;markdown:string;offset:number;nextOffset:number|null;totalChars:number;
}
export interface KnowledgePublication {expectedVersion:number;revisionId:string;operationId:string}
export class KnowledgeApiError extends PublicUiError {
  constructor(readonly code:string,readonly status:number,message:string){super(message);this.name='KnowledgeApiError';}
}
const root='/api/admin/assistant-knowledge/articles';
const memberRoot='/api/me/assistant-knowledge';
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const natural=(value:unknown):value is number=>Number.isSafeInteger(value)&&Number(value)>=0;
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const texts=(value:unknown):value is string[]=>Array.isArray(value)&&value.every(item=>typeof item==='string');
function invalid():never{throw new KnowledgeApiError('invalid_response',0,'知识库响应无效，请刷新后重试。');}
function article(value:unknown):KnowledgeArticle{
  if(!record(value)||!uuid(value.articleId)||typeof value.title!=='string'||typeof value.markdown!=='string'
    ||!texts(value.aliases)||!texts(value.keywords)||typeof value.category!=='string'||typeof value.sourceNote!=='string'
    ||!natural(value.version)||!uuid(value.draftRevisionId)||!(value.publishedRevisionId===null||uuid(value.publishedRevisionId))
    ||!(value.targetRevisionId===null||uuid(value.targetRevisionId))||!natural(value.publicationGeneration)
    ||typeof value.indexStatus!=='string'||!(value.indexError===null||typeof value.indexError==='string')||typeof value.updatedAt!=='string')invalid();
  return value as unknown as KnowledgeArticle;
}
function reference(value:unknown):KnowledgeReference{
  if(!record(value)||!uuid(value.sourceId)||!uuid(value.articleId)||!uuid(value.revisionId)
    ||!natural(value.revisionNumber)||typeof value.title!=='string'||!texts(value.sectionPath)
    ||typeof value.excerpt!=='string'||!natural(value.ordinal))invalid();
  return value as unknown as KnowledgeReference;
}
async function json(path:string,options:RequestInit={}):Promise<unknown>{
  const response=await request(path,options);
  if(!response.ok){
    const failure=await readFailure(response);
    const message=response.status===409?'内容已在其他位置更新，请先重新读取；当前编辑内容已保留。':
      response.status===403?'当前账号没有知识库管理权限。':response.status===404?'这份资料已下架或暂时无法查看。':
      response.status===503?'知识库索引服务暂时不可用，已发布内容继续保留。':failure.message;
    throw new KnowledgeApiError(failure.code,response.status,message);
  }
  return response.status===204?null:await response.json().catch(()=>invalid());
}
function write(method:string,payload:unknown,csrf:string):RequestInit{
  return {method,headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(payload)};
}
export async function fetchKnowledgeArticles(offset=0):Promise<{items:KnowledgeArticle[];total:number}>{
  const value=await json(`${root}?limit=40&offset=${offset}`);
  if(!record(value)||!Array.isArray(value.items)||value.items.length>40||!natural(value.total))invalid();
  return {items:value.items.map(article),total:value.total};
}
export async function fetchKnowledgeArticle(id:string):Promise<KnowledgeArticle>{return article(await json(`${root}/${encodeURIComponent(id)}`));}
export async function saveKnowledgeArticle(id:string|null,draft:KnowledgeDraft,csrf:string):Promise<KnowledgeArticle>{
  return article(await json(id?`${root}/${encodeURIComponent(id)}`:root,write(id?'PUT':'POST',draft,csrf)));
}
export async function publishKnowledgeRevision(id:string,publication:KnowledgePublication,csrf:string):Promise<KnowledgeArticle>{
  return article(await json(`${root}/${encodeURIComponent(id)}/publish`,write('POST',publication,csrf)));
}
export async function rollbackKnowledgeRevision(id:string,publication:KnowledgePublication,csrf:string):Promise<KnowledgeArticle>{
  return article(await json(`${root}/${encodeURIComponent(id)}/rollback`,write('POST',publication,csrf)));
}
export async function unpublishKnowledgeArticle(id:string,expectedVersion:number,operationId:string,csrf:string):Promise<KnowledgeArticle>{
  return article(await json(`${root}/${encodeURIComponent(id)}/unpublish`,write('POST',{expectedVersion,operationId},csrf)));
}
export async function deleteKnowledgeArticle(id:string,expectedVersion:number,operationId:string,csrf:string):Promise<void>{
  await json(`${root}/${encodeURIComponent(id)}`,write('DELETE',{expectedVersion,operationId},csrf));
}
export async function fetchKnowledgeRevisions(id:string,offset=0):Promise<KnowledgeRevision[]>{
  const value=await json(`${root}/${encodeURIComponent(id)}/revisions?limit=40&offset=${offset}`);
  if(!record(value)||!Array.isArray(value.items))invalid();
  return value.items.map((item:unknown)=>{
    if(!record(item)||!uuid(item.revisionId)||!natural(item.revisionNumber)||typeof item.title!=='string'
      ||typeof item.markdown!=='string'||!texts(item.aliases)||!texts(item.keywords)||typeof item.category!=='string'
      ||typeof item.sourceNote!=='string'||typeof item.contentDigest!=='string'||typeof item.createdAt!=='string'||typeof item.publishedBefore!=='boolean')invalid();
    return item as unknown as KnowledgeRevision;
  });
}
export async function fetchKnowledgeSource(id:string,offset=0):Promise<KnowledgeSourcePage>{
  const value=await json(`${memberRoot}/sources/${encodeURIComponent(id)}?offset=${offset}&limit=6000`);
  if(!record(value)||value.sourceId!==id||!uuid(value.articleId)||!natural(value.revisionNumber)
    ||typeof value.title!=='string'||typeof value.markdown!=='string'||value.offset!==offset||!natural(value.totalChars)
    ||!(value.nextOffset===null||natural(value.nextOffset)&&value.nextOffset>offset&&value.nextOffset<=value.totalChars))invalid();
  return value as unknown as KnowledgeSourcePage;
}
export async function fetchExecutionKnowledgeSources(id:string):Promise<KnowledgeReference[]>{
  const value=await json(`${memberRoot}/executions/${encodeURIComponent(id)}/sources`);
  if(!record(value)||!Array.isArray(value.sources)||value.sources.length>20)invalid();
  return value.sources.map(reference);
}
