import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {readLearningPosition,saveLearningPosition,readStudyPlan,type LearningPosition} from '../../api/studyPlanClient';
export function useMapLearningState(accountId:string,entryId:string,csrfToken:string){
  const client=useQueryClient();const positionKey=['me',accountId,'learning-position',entryId];const planKey=['me',accountId,'study-plan',entryId];
  const position=useQuery({queryKey:positionKey,queryFn:()=>readLearningPosition(entryId),retry:false});
  const plan=useQuery({queryKey:planKey,queryFn:()=>readStudyPlan(entryId),retry:false,refetchInterval:query=>query.state.data?.task&&!['succeeded','failed','stopped'].includes(query.state.data.task.state)?2500:false});
  const current=useMutation({mutationFn:({nodeId,conversationId=null}:{nodeId:string;conversationId?:string|null})=>saveLearningPosition(entryId,nodeId,conversationId,client.getQueryData<LearningPosition|null>(positionKey)?.version??0,csrfToken),onSuccess:saved=>{client.setQueryData(positionKey,saved);},onError:()=>{void position.refetch();}});
  return {position,plan,current};
}
