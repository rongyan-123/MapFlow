export const modelPresets = [
  { id: 'anyai', label: '爱你 AI', baseUrl: 'https://anyai.token6688.com/v1', models: ['deepseek-v4-flash', 'gpt-5.4-nano', 'deepseek-v4-pro', 'gpt-5.4-mini', 'gpt-5.4', 'claude-sonnet-4-6', 'gemini-3.8-flash', 'qwen3.8-flash', 'kimi-k3'] },
  { id: 'deepseek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', models: ['deepseek-flash', 'deepseek-v4-pro'] },
  { id: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', models: [] },
  { id: 'qwen', label: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', models: [] },
  { id: 'custom', label: '自定义', baseUrl: '', models: [] },
];
