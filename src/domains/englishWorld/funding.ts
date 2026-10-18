import { useAgentModelConfiguration } from '../models/AgentModelContext';
import { useSharedModelSelection } from '../models/ModelSelectionContext';
import { PublicUiError } from '../../lib/publicErrors';
import type { FundingSelection } from './types';

export function useWorldFunding() {
  const model = useAgentModelConfiguration();
  const shared = useSharedModelSelection()!;
  function selection(): FundingSelection {
    const options = model.options;
    if (options.funding === 'cash') {
      if (!options.profileId || !options.profileVersion) throw new PublicUiError('请先选择当前可用的现金模型。');
      return { funding: 'cash', profileId: options.profileId, profileVersion: options.profileVersion };
    }
    if (options.funding === 'points') {
      if (!model.catalogue.data?.points) throw new PublicUiError('平台积分模型暂未配置，请选择其他资金通路。');
      return { funding: 'points' };
    }
    const access = shared.selection;
    if (!access.apiKey.trim() || !access.model.trim() || !access.baseUrl.trim() || !Number.isSafeInteger(options.contextWindow) || !options.contextWindow || options.contextWindow < 1) {
      throw new PublicUiError('请在模型与资金设置中填写 API Key、接口地址、模型和上下文窗口。');
    }
    return { funding: 'byok', modelAccess: { apiKey: access.apiKey.trim(), baseUrl: access.baseUrl.trim(), model: access.model.trim(), contextWindow: options.contextWindow,
      maxOutputTokens: options.maxOutputTokens, reasoningProtocol: options.reasoningProtocol ?? 'none', reasoningSupported: options.reasoningSupported ?? false } };
  }
  return { selection, apiKey: shared.selection.apiKey, label: model.options.modelLabel || shared.selection.model || '选择模型与资金' };
}
