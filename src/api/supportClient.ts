import {request,readFailure} from './http';
import {IdentityApiError} from './identityClient';
import {PublicUiError} from '../lib/publicErrors';

export interface FeedbackSummary {feedbackId:string;username:string;content:string;createdAt:string;replyCount:number}
export interface FeedbackReply {replyId:string;content:string;createdAt:string}
export interface FeedbackDetail extends FeedbackSummary {replies:FeedbackReply[];nextCursor:string|null}
export interface SupportPage<T> {items:T[];nextCursor:string|null}
export type NotificationKind='all'|'announcement'|'feedback_reply';
export interface NotificationItem {notificationId:string;kind:Exclude<NotificationKind,'all'>;title:string;preview:string;createdAt:string;isRead:boolean;targetId:string}
export interface NotificationDetail {notificationId:string;title:string;content:string}

const record=(value:unknown):value is Record<string,unknown>=>typeof value==='object'&&value!==null&&!Array.isArray(value);
const strings=(value:Record<string,unknown>,keys:string[])=>keys.every(key=>typeof value[key]==='string');
const cursor=(value:unknown)=>value===null||typeof value==='string';
const count=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;
function invalid():never {throw new PublicUiError('消息服务返回了无法识别的结果，请重新读取。');}
function feedback(value:unknown):FeedbackSummary {if(!record(value)||!strings(value,['feedbackId','username','content','createdAt'])||!count(value.replyCount))return invalid();return value as unknown as FeedbackSummary;}
function reply(value:unknown):FeedbackReply {if(!record(value)||!strings(value,['replyId','content','createdAt']))return invalid();return value as unknown as FeedbackReply;}
function page<T>(value:unknown,parse:(item:unknown)=>T):SupportPage<T> {if(!record(value)||!Array.isArray(value.items)||value.items.length>20||!cursor(value.nextCursor))return invalid();return {items:value.items.map(parse),nextCursor:value.nextCursor as string|null};}
function message(value:unknown):NotificationItem {if(!record(value)||!strings(value,['notificationId','title','preview','createdAt','targetId'])||!['announcement','feedback_reply'].includes(String(value.kind))||typeof value.isRead!=='boolean')return invalid();return value as unknown as NotificationItem;}
async function send(path:string,options:RequestInit={}):Promise<Response> {
  let response:Response;
  try{response=await request(path,options);}catch{throw new PublicUiError('消息服务暂时无法连接，请稍后重试。');}
  if(!response.ok){const error=await readFailure(response,'support.unavailable');throw new IdentityApiError(error.status,error.code,error.message,error.traceId);}
  return response;
}
async function json(path:string,options?:RequestInit):Promise<unknown>{const response=await send(path,options);try{return await response.json();}catch{return invalid();}}
function post(csrfToken:string,body:unknown):RequestInit{return {method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrfToken},body:JSON.stringify(body)};}
function suffix(parameters:Record<string,string|undefined>){const query=new URLSearchParams();for(const [key,value] of Object.entries(parameters))if(value)query.set(key,value);return query.size?'?'+query:'';}
export async function getFeedbackPage(after?:string,adminState?:string){return page(await json((adminState?'/api/admin/feedback/threads':'/api/me/feedback')+suffix({cursor:after,state:adminState})),feedback);}
export async function submitFeedbackThread(content:string,requestId:string,csrfToken:string){return feedback(await json('/api/me/feedback',post(csrfToken,{content,requestId})));}
export async function getFeedbackDetail(feedbackId:string,after?:string,admin=false):Promise<FeedbackDetail>{
  const value=await json((admin?'/api/admin/feedback/':'/api/me/feedback/')+encodeURIComponent(feedbackId)+suffix({cursor:after}));
  const summary=feedback(value);if(!record(value)||!Array.isArray(value.replies)||value.replies.length>20||!cursor(value.nextCursor))return invalid();
  return {...summary,replies:value.replies.map(reply),nextCursor:value.nextCursor as string|null};
}
export async function replyToFeedback(feedbackId:string,content:string,requestId:string,csrfToken:string){return reply(await json('/api/admin/feedback/'+encodeURIComponent(feedbackId)+'/replies',post(csrfToken,{content,requestId})));}
export async function getNotificationPage(kind:NotificationKind,after?:string){return page(await json('/api/me/notifications'+suffix({kind,cursor:after})),message);}
export async function getNotificationDetail(id:string):Promise<NotificationDetail>{const value=await json('/api/me/notifications/'+encodeURIComponent(id));if(!record(value)||!strings(value,['notificationId','title','content']))return invalid();return value as unknown as NotificationDetail;}
export async function getUnreadNotificationCount(){const value=await json('/api/me/notifications/count');if(!record(value)||!count(value.unreadCount))return invalid();return value.unreadCount;}
export async function markNotificationsRead(notificationIds:string[],csrfToken:string){await send('/api/me/notifications/read',post(csrfToken,{notificationIds}));}
export async function markAllNotificationsRead(kind:NotificationKind,csrfToken:string){await send('/api/me/notifications/read-all',post(csrfToken,{kind}));}
