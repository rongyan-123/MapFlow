import publicContent from '../../content/publicContent.json';
export interface AgentGuideSection{id:string;group:string;title:string;paragraphs:string[];command?:string}
export const agentGuide:AgentGuideSection[]=publicContent.agentGuide;
export const learningGuide=publicContent.learningGuide;
