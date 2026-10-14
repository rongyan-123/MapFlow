export type DeepSeekModel = 'deepseek-v4-flash' | 'deepseek-v4-pro';
export type ThinkingMode = 'enabled' | 'disabled';
export type ReasoningEffort = 'low' | 'high' | 'max';
export interface UserModelSetting {
  name: string;
  kind: 'switch' | 'select';
  options: string[];
}

export interface UserModelProfile {
  id: string;
  provider: string;
  contextWindow: number;
  baseUrl: string;
  settings: UserModelSetting[];
}
