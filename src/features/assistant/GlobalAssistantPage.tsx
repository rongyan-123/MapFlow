import AgentTavernPage from './AgentTavernPage';
export default function GlobalAssistantPage({onNavigateLearning,onNavigateWallet,onNavigateModels}: {
  onNavigateLearning:()=>void;onNavigateWallet?:()=>void;onNavigateModels?:()=>void;
}){
  return <AgentTavernPage management title="全局助手" onNavigateConsole={onNavigateLearning} onNavigateLearning={onNavigateLearning}
    onNavigateWallet={onNavigateWallet} onNavigateModels={onNavigateModels} />;
}
