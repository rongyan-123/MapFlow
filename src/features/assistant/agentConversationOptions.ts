import type {AgentFunding} from './agentExecutionClient';
export interface AgentConversationOptions {
  funding:AgentFunding;profileId?:string;profileVersion?:number;modelLabel?:string;modelId?:string;
  contextWindow?:number;maxOutputTokens?:number|null;
  reasoningProtocol?:'none'|'deepseek'|'siliconflow'|'openai_reasoning';reasoningSupported?:boolean;
}
