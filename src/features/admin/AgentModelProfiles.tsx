import {useState,type FormEvent} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {activateAgentModelProfile,fetchAgentModelConfiguration,saveAgentModelProfile,type AgentFunding,type AgentModelProfile} from './agentModelClient';
const inputClass='mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100';
export default function AgentModelProfiles({csrfToken}:{csrfToken:string}) {
  const client=useQueryClient();
  const query=useQuery({queryKey:['admin','agent-models'],queryFn:fetchAgentModelConfiguration,retry:false});
  const [editing,setEditing]=useState(false),[notice,setNotice]=useState('');
  const activation=useMutation({mutationFn:(profile:AgentModelProfile)=>activateAgentModelProfile({funding:profile.funding,
    profileId:profile.snapshot.profileId,profileVersion:profile.snapshot.profileVersion,
    expectedEpoch:(profile.funding==='cash'?query.data?.activeCash:query.data?.activePoints)?.epoch??0},csrfToken),
    onSuccess:data=>{client.setQueryData(['admin','agent-models'],data);setNotice('模型已切换；正在执行的任务继续使用原配置。');}});
  if (query.isPending) return <p className="text-sm text-slate-400">正在读取持久化模型配置…</p>;
  if (!query.data) return <div role="alert" className="text-rose-300">模型配置暂不可用。<button type="button" onClick={()=>void query.refetch()}>重新读取</button></div>;
  const configuration=query.data;
  return <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-5">
    <header className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">模型配置</h2>
      <button type="button" className="rounded-lg bg-cyan-300 px-3 py-2 text-sm font-bold text-slate-950" onClick={()=>setEditing(true)}>新增模型配置</button></header>
    <p className="text-sm text-slate-400">现金额度与平台积分分别设置默认模型。配置保存后先测试再启用，重启后保留选择。</p>
    <p className="text-xs text-slate-400">启用时会实际调用模型，验证工具、流式输出和计费能力。测试消耗接入账号额度，不扣用户钱包。</p>
    <div className="grid gap-3 sm:grid-cols-2">{(['cash','points'] as const).map(funding=>{
      const active=funding==='cash'?configuration.activeCash:configuration.activePoints;
      return <div key={funding} aria-label={`当前${funding==='cash'?'现金':'积分'}模型`} className="rounded-lg border border-slate-700 p-3">
        <p className="text-xs text-slate-400">{funding==='cash'?'现金额度':'平台积分'}</p><p className="mt-1 font-semibold">{active?.profile.displayName??'尚未配置'}</p>
        {active && <p className="mt-1 text-xs text-slate-400">版本 {active.profile.snapshot.profileVersion} · {active.profile.snapshot.modelId}</p>}</div>;
    })}</div>
    {activation.error && <p role="alert" className="text-sm text-rose-300">{activation.error.message}</p>}
    {notice && <p role="status" className="text-sm text-cyan-200">{notice}</p>}
    <div className="grid gap-3 lg:grid-cols-2">{configuration.profiles.map(profile=>{
      const active=profile.funding==='cash'?configuration.activeCash:configuration.activePoints;
      const enabled=active?.profile.snapshot.profileId===profile.snapshot.profileId && active.profile.snapshot.profileVersion===profile.snapshot.profileVersion;
      return <article key={profile.snapshot.profileId} className="rounded-lg border border-slate-700 p-4">
        <h3 className="font-semibold">{profile.displayName}</h3><p className="mt-1 text-xs text-slate-400">{profile.funding==='cash'?'现金额度':'平台积分'} · v{profile.snapshot.profileVersion}</p>
        <p className="mt-3 break-all text-sm">{profile.snapshot.modelId}</p><p className="mt-1 text-xs text-slate-400">上下文 {profile.snapshot.contextWindow.toLocaleString()} Token</p>
        <p className="mt-1 text-xs text-slate-400">输出：{profile.snapshot.maxOutputTokens===null?'由模型决定':`${profile.snapshot.maxOutputTokens.toLocaleString()} Token`}</p>
        <button type="button" className="mt-3 rounded-lg border border-cyan-400 px-3 py-2 text-sm disabled:opacity-50" disabled={enabled||activation.isPending}
          onClick={()=>activation.mutate(profile)}>{enabled?'已启用':activation.isPending?'正在测试…':`启用 ${profile.displayName}`}</button>
      </article>;
    })}</div>
    {editing && <ProfileEditor existing={configuration.profiles} csrfToken={csrfToken} onSaved={data=>{
      client.setQueryData(['admin','agent-models'],data);setNotice('配置版本已保存，点击启用后进行连接测试。');}} onClose={()=>setEditing(false)}/>}
  </section>;
}
function ProfileEditor({existing,csrfToken,onSaved,onClose}:{existing:AgentModelProfile[];csrfToken:string;
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
  return <form onSubmit={submit} className="space-y-3 rounded-xl border border-cyan-400/40 bg-slate-950 p-4">
    <h3 className="font-semibold">保存新版本</h3><p className="text-xs text-slate-400">已有标识会新增版本。留空 Key 可沿用该配置原密钥，密钥内容不会回填。</p>
    <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">计费路径<select className={inputClass} value={funding} onChange={event=>setFunding(event.target.value as AgentFunding)}><option value="points">平台积分</option><option value="cash">现金额度</option></select></label>
      <label className="text-sm">配置标识<input required pattern="[A-Za-z0-9][A-Za-z0-9_.:-]*" className={inputClass} value={id} onChange={event=>setId(event.target.value)}/></label>
      <label className="text-sm">显示名称<input required className={inputClass} value={name} onChange={event=>setName(event.target.value)}/></label>
      <label className="text-sm">模型 ID<input required className={inputClass} value={model} onChange={event=>setModel(event.target.value)}/></label>
      <label className="text-sm">API 地址<input required type="url" className={inputClass} value={base} onChange={event=>setBase(event.target.value)}/></label>
      <label className="text-sm">API Key<input type="password" autoComplete="new-password" className={inputClass} value={key} onChange={event=>setKey(event.target.value)}/></label>
      <label className="text-sm">模型上下文 Token<input required type="number" min="1" className={inputClass} value={window} onChange={event=>setWindow(event.target.value)}/></label>
      <label className="text-sm">参数协议<select className={inputClass} value={dialect} onChange={event=>setDialect(event.target.value as typeof dialect)}>
        <option value="siliconflow">SiliconFlow</option><option value="deepseek">DeepSeek</option><option value="openai_reasoning">OpenAI 推理</option><option value="none">普通聊天</option></select></label>
    </div>
    {funding==='points' && <fieldset className="grid gap-3 sm:grid-cols-3"><legend className="mb-2 text-xs text-slate-400">每百万 Token 扣除的积分单位（1 积分 = 1,000,000 单位）</legend>
      {['输入积分单位','缓存命中积分单位','输出积分单位'].map((label,index)=><label key={label} className="text-xs">{label}<input required type="number" min="0" className={inputClass} value={rates[index]} onChange={event=>setRates(previous=>previous.map((rate,position)=>position===index?event.target.value:rate))}/></label>)}</fieldset>}
    <details><summary className="cursor-pointer text-sm">高级参数协议</summary><label className="mt-2 block text-xs">参数策略 JSON<textarea className={inputClass} rows={4} placeholder="留空使用所选协议的常用参数" value={policy} onChange={event=>setPolicy(event.target.value)}/></label></details>
    {(error||save.error) && <p role="alert" className="text-sm text-rose-300">{error||save.error?.message}</p>}
    <div className="flex gap-3"><button type="submit" disabled={save.isPending} className="rounded-lg bg-cyan-300 px-3 py-2 text-sm font-bold text-slate-950">{save.isPending?'正在保存…':'保存配置版本'}</button><button type="button" onClick={onClose}>关闭</button></div>
  </form>;
}
