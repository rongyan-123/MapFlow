import type {AgentSendOptions} from '../../domains/conversations/agentRun';
import type {AgentConversationOptions} from '../../domains/models/agentOptions';
import type {TavernModelSelection} from '../../domains/conversations/types';
import {PublicUiError} from '../../lib/publicErrors';

export function globalModelCommand(options:AgentConversationOptions,selection:TavernModelSelection):AgentSendOptions {
  if(options.funding==='cash'){
    if(!options.profileId||!options.profileVersion)throw new PublicUiError('请在模型设置中选择可用的现金模型。');
    return {funding:'cash',profileId:options.profileId,profileVersion:options.profileVersion};
  }
  if(options.funding==='points'){
    if(!options.modelId)throw new PublicUiError('积分模型暂未配置，请在模型设置中选择可用通路。');
    return {funding:'points'};
  }
  if(selection.provider!=='custom'||!selection.apiKey.trim()||!selection.model.trim()||!/^https:\/\/[^\s]+\/v1\/?$/u.test(selection.baseUrl.trim())
    ||!Number.isSafeInteger(options.contextWindow)||!options.contextWindow||options.contextWindow<1)throw new PublicUiError('请在模型设置中填写 API Key、模型、HTTPS 接口和实际上下文窗口。');
  return {funding:'byok',modelAccess:{apiKey:selection.apiKey.trim(),baseUrl:selection.baseUrl.trim(),model:selection.model.trim(),contextWindow:options.contextWindow,
    maxOutputTokens:options.maxOutputTokens,reasoningProtocol:options.reasoningProtocol??'none',reasoningSupported:options.reasoningSupported??false}};
}
