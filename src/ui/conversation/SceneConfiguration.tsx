import type { ConversationOwner } from '../../domains/conversations/conversationScope';
import type { Character, Conversation, ConversationDetail } from '../../domains/conversations/types';
import type { useConversationExecution } from '../../domains/conversations/useConversationExecution';
import { Button } from '../Button';
import { ConfigurationDialog, type ConfigurationSection } from './ConfigurationDialog';
import { CharacterAvatar, CompatibilityReport } from './CharacterPresentation';
import ModelSettings from './ModelSettings';
import ToolSettings from './ToolSettings';
import ConversationProfileForm from './ConversationProfileForm';
import BranchesSettings from './BranchesSettings';

interface Props {
  section: ConfigurationSection;
  owner: ConversationOwner;
  current?: ConversationDetail;
  selectedRole?: Character;
  conversations: Conversation[];
  conversationId: string | null;
  canCreate: boolean;
  executionBusy: boolean;
  settingsBusy: boolean;
  runtime?: ReturnType<typeof useConversationExecution>;
  onSelect: (id: string) => void;
  onLibrary: () => void;
  onHistory: () => void;
  onWallet: () => void;
  onUpdated: (detail: ConversationDetail) => void;
  onConflict: () => Promise<void>;
  onBusyChange: (busy: boolean) => void;
  onClose: () => void;
}

export default function SceneConfiguration(props: Props) {
  const { owner, current, selectedRole, runtime } = props;
  const roleSelectionAllowed = owner.scene !== 'management';
  const readonly = owner.available === false;
  const overview = <div className="mf-stack mf-overview">
    <label className="mf-field">历史会话<select value={props.conversationId ?? ''} onChange={event => props.onSelect(event.target.value)}>
      <option value="" disabled>选择历史会话</option>
      {props.conversations.map(story => <option key={story.conversationId} value={story.conversationId}>{story.title} · {story.userName}</option>)}
    </select></label>
    {selectedRole ? <>
      <CharacterAvatar character={selectedRole} large /><h3>{selectedRole.card.name}</h3>
      <details><summary>角色设定</summary><p className="mf-role-description">{selectedRole.card.description || '没有角色描述。'}</p></details>
      {selectedRole.card.scenario && <details><summary>场景</summary><p className="mf-role-description">{selectedRole.card.scenario}</p></details>}
      <p className="mf-muted mf-small">世界书（对话用的背景资料）：{selectedRole.card.lorebook.filter(entry => entry.enabled).length} / {selectedRole.card.lorebook.length} 条启用</p>
      {roleSelectionAllowed && selectedRole.sourceHash && props.canCreate && <a className="mf-button" href={`/api/me/tavern/characters/${encodeURIComponent(selectedRole.characterId)}/source`} download>下载原始角色卡</a>}
      <CompatibilityReport warnings={selectedRole.card.warnings} initiallyOpen={false} />
    </> : <p className="mf-status">{roleSelectionAllowed ? '导入或创建角色，开始一段对话。' : '开始新对话后，将自动使用平台全局助手。'}</p>}
    <div className="mf-row mf-wrap">
      {roleSelectionAllowed ? <Button onClick={props.onLibrary}>打开角色库</Button> : <p className="mf-muted mf-small">平台统一提供的全局助手，角色设定由平台维护。</p>}
      <Button onClick={props.onHistory}>会话历史</Button>
    </div>
  </div>;
  return <ConfigurationDialog initialSection={props.section} busy={props.settingsBusy} onClose={props.onClose} content={{
    overview,
    model: <ModelSettings accountId={owner.accountId} csrfToken={owner.csrfToken} onWallet={props.onWallet} locked={props.executionBusy} />,
    tools: current && !readonly ? <ToolSettings key={`${current.conversation.conversationId}.${current.graph.revision}`} detail={current}
      csrfToken={owner.csrfToken} onUpdated={props.onUpdated} onConflict={props.onConflict} onBusyChange={props.onBusyChange}
      onCanvas={() => { props.onClose(); if (runtime) void runtime.openTeachingCanvas(); }}
    /> : <p className="mf-status">新建会话后，可以使用画布与对应学习区的地图工具。</p>,
    profile: current && !readonly ? <ConversationProfileForm detail={current} csrfToken={owner.csrfToken} onUpdated={props.onUpdated}
      onConflict={props.onConflict} onBusyChange={props.onBusyChange}
    /> : <p className="mf-status">{readonly ? '当前学习区仅查看历史。' : '新建会话后，可以修改用户称呼、角色身份和词表。'}</p>,
    branches: runtime ? <BranchesSettings state={runtime} readOnly={readonly} /> : <p className="mf-status">对话开始后，可以从历史回复创建分支和检查点。</p>,
  }} />;
}
