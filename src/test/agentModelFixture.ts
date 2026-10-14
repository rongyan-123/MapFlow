export function configurationFixture(){
  const profile={funding:'points' as const,displayName:'原积分模型',snapshot:{profileId:'points-test',profileVersion:1,
    adapter:'openai_compatible' as const,baseUrl:'https://api.siliconflow.cn/v1',modelId:'Qwen/Qwen3-8B',
    credentialId:'00000000-0000-0000-0000-000000000021',credentialVersion:1,contextWindow:131072,maxOutputTokens:null,
    toolsSupported:true,streamSupported:true,reasoning:null,billingPolicy:'points:points-test:1',actualFeeSupported:false},
    parameterPolicy:{reasoningProtocol:'siliconflow' as const,supportedFields:['temperature','max_tokens','enable_thinking','stop'],defaults:{enable_thinking:false}},
    pointsPolicy:{inputUnitsPerMillion:1000000,cacheHitUnitsPerMillion:100000,outputUnitsPerMillion:2000000}};
  const newer={...profile,displayName:'候选积分模型',snapshot:{...profile.snapshot,profileVersion:2,billingPolicy:'points:points-test:2'}};
  return {profiles:[newer],activeCash:null,activePoints:{profile,epoch:3}};
}
