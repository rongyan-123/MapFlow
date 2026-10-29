import { request,readFailure } from './http';
import { PublicUiError } from '../lib/publicErrors';
import type { ModelPurpose,SceneModelPreference } from '../domains/models/scenePreferences';
export class StudyPlanApiError extends PublicUiError{constructor(readonly status:number,message:string){super(message);}}
export async function studyRequest<T>(path:string,method='GET',body?:unknown,csrfToken?:string):Promise<T>{
  const response=await request(path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(csrfToken?{'X-CSRF-Token':csrfToken}:{})},...(body?{body:JSON.stringify(body)}:{})});
  if(!response.ok){const value=await response.clone().json().catch(()=>null);if(value?.error?.code==='study_plan.conflict'&&typeof value.error.message==='string')throw new StudyPlanApiError(response.status,value.error.message);throw new StudyPlanApiError(response.status,(await readFailure(response)).message);}
  return response.json() as Promise<T>;
}
export type SceneModelEntries=Partial<Record<ModelPurpose,{version:number;settings:SceneModelPreference}>>;
export const readSceneModels=()=>studyRequest<SceneModelEntries>('/api/me/scene-models');
export const migrateSceneModels=(settings:SceneModelPreference,csrf:string)=>studyRequest<SceneModelEntries>('/api/me/scene-models/migrate','POST',{settings},csrf);
export const saveSceneModel=(purpose:ModelPurpose,expectedVersion:number,settings:SceneModelPreference,csrf:string)=>studyRequest<{version:number;settings:SceneModelPreference}>(`/api/me/scene-models/${purpose}`,'PUT',{expectedVersion,settings},csrf);
export interface LearningPosition{nodeId:string;conversationId:string|null;version:number;available:boolean}
const path=(entry:string)=>`/api/me/tree-library/${encodeURIComponent(entry)}`;
export const readLearningPosition=(entry:string)=>studyRequest<LearningPosition|null>(`${path(entry)}/learning-position`);
export const saveLearningPosition=(entry:string,nodeId:string,conversationId:string|null,expectedVersion:number,csrf:string)=>studyRequest<LearningPosition>(`${path(entry)}/learning-position`,'PUT',{nodeId,conversationId,expectedVersion},csrf);
export interface PlanItem{nodeId:string;partIndex:number;partCount:number;estimatedMinutes:number;focus:string}
export interface PlanDay{date:string;items:PlanItem[]}
export interface PlanConditions{deadline:string;startDate:string|null;dailyMinutes:number|null;timezone:string;expectedVersion:number}
export interface PlanSubmission{schemaVersion:1;outcome:'scheduled'|'needs_adjustment';days:PlanDay[];unassignedNodeIds:string[];summary:string}
export interface SavedPlan{days:PlanDay[];summary:string;conditions:PlanConditions;timezone:string;startDate:string;deadline:string;policyVersion:number}
export interface StudyPlanState{version:number;plan:SavedPlan|null;task:{executionId:string;clientActionId?:string;state:string;conditions:PlanConditions;policyVersion:number;accepted:boolean;failure:unknown;submission:PlanSubmission|null}|null}
export const readStudyPlan=(entry:string)=>studyRequest<StudyPlanState>(`${path(entry)}/study-plan`);
export const createStudyPlan=(entry:string,body:unknown,csrf:string)=>studyRequest<{executionId:string|null;allComplete:boolean}>(`${path(entry)}/study-plan`,'POST',body,csrf);
export const stopStudyPlan=(entry:string,executionId:string,clientActionId:string,csrf:string)=>studyRequest<StudyPlanState>(`${path(entry)}/study-plan/stop`,'POST',{executionId,clientActionId},csrf);
export const resumeStudyPlan=(entry:string,executionId:string,apiKey:string|undefined,csrf:string)=>studyRequest<StudyPlanState>(`${path(entry)}/study-plan/resume`,'POST',{executionId,apiKey},csrf);
export interface PlanPolicy{revision:number;draft:string;publishedVersion:number;publishedBody:string;skillVersion:string;toolVersion:string;versions:{version:number;body:string;createdAt:string;rollbackOf:number|null}[]}
export const readPlanPolicy=()=>studyRequest<PlanPolicy>('/api/admin/study-plan-policy');
export const savePlanPolicy=(revision:number,body:string,csrf:string)=>studyRequest<PlanPolicy>('/api/admin/study-plan-policy','PUT',{revision,body},csrf);
export const publishPlanPolicy=(revision:number,rollbackVersion:number|null,csrf:string)=>studyRequest<PlanPolicy>('/api/admin/study-plan-policy/publish','POST',{revision,rollbackVersion},csrf);
