import {useState,type FormEvent} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {activateAgentModelProfile,fetchAgentModelConfiguration,saveAgentModelProfile,type AgentFunding,type AgentModelProfile} from '../../api/agentModelClient';
export function useAdminModels({csrfToken}:{csrfToken:string}) {
  const client=useQueryClient();
  const query=useQuery({queryKey:['admin','agent-models'],queryFn:fetchAgentModelConfiguration,retry:false});
  const [editing,setEditing]=useState(false),[notice,setNotice]=useState('');
  const activation=useMutation({mutationFn:(profile:AgentModelProfile)=>activateAgentModelProfile({funding:profile.funding,
    profileId:profile.snapshot.profileId,profileVersion:profile.snapshot.profileVersion,
    expectedEpoch:(profile.funding==='cash'?query.data?.activeCash:query.data?.activePoints)?.epoch??0},csrfToken),
    onSuccess:data=>{client.setQueryData(['admin','agent-models'],data);setNotice('模型已切换；正在执行的任务继续使用原配置。');}});
return {query,editing,setEditing,notice,setNotice,activation,client};
}
export function useModelProfileEditor({existing,csrfToken,onSaved,onClose}:{existing:AgentModelProfile[];csrfToken:string;
  onSaved:(configuration:Awaited<ReturnType<typeof saveAgentModelProfile>>)=>void;onClose:()=>void}) {
  const [funding,setFunding]=useState<AgentFunding>('points'),[id,setId]=useState(''),[name,setName]=useState(''),[key,setKey]=useState('');
  const [base,setBase]=useState('https://api.siliconflow.cn/v1'),[model,setModel]=useState('Qwen/Qwen3-8B'),[window,setWindow]=useState('131072');
  const [dialect,setDialect]=useState<'siliconflow'|'deepseek'|'none'|'openai_reasoning'>('siliconflow');
  const [policy,setPolicy]=useState(''),[error,setError]=useState('');
  const [rates,setRates]=useState(['1000000','100000','2000000']);
  const save=useMutation({mutationFn:(body:{profile:AgentModelProfile;apiKey?:string})=>saveAgentModelProfile(body,csrfToken),onSuccess:data=>{setKey('');onSaved(data);}});
  function submit(event:FormEvent){event.preventDefault();setError('');
    try {
      const prior=existing.find(profile=>profile.snapshot.profileId===id);
      const version=(prior?.snapshot.profileVersion??0)+1;
      if (!key && !prior) throw new Error('新配置需要输入 API Key。');
      const fields=['temperature','max_tokens','stop',...(dialect==='siliconflow'?['enable_thinking']:dialect==='deepseek'?['thinking']:dialect==='openai_reasoning'?['reasoning_effort']:[])];
      const parameterPolicy=policy.trim()?JSON.parse(policy) as AgentModelProfile['parameterPolicy']:{reasoningProtocol:dialect,supportedFields:fields,
        defaults:dialect==='siliconflow'?{enable_thinking:false}:{}};
      const profile:AgentModelProfile={funding,displayName:name,parameterPolicy,
        pointsPolicy:funding==='points'?{inputUnitsPerMillion:Number(rates[0]),cacheHitUnitsPerMillion:Number(rates[1]),outputUnitsPerMillion:Number(rates[2])}:null,
        snapshot:{profileId:id,profileVersion:version,adapter:dialect==='deepseek'?'deepseek':'openai_compatible',baseUrl:base,modelId:model,
          credentialId:key?crypto.randomUUID():prior!.snapshot.credentialId,credentialVersion:key?1:prior!.snapshot.credentialVersion,
          contextWindow:Number(window),maxOutputTokens:null,toolsSupported:true,streamSupported:true,reasoning:dialect==='none'?null:'native',
          billingPolicy:funding==='cash'?'cash-actual-x2-v1':`points:${id}:${version}`,actualFeeSupported:funding==='cash'}};
      save.mutate({profile,...(key?{apiKey:key}:{})});
    } catch(cause){setError(cause instanceof Error?cause.message:'配置内容无效。');}
  }
return {funding,setFunding,id,setId,name,setName,key,setKey,base,setBase,model,setModel,window,setWindow,dialect,setDialect,policy,setPolicy,error,setError,rates,setRates,save,submit};
}
