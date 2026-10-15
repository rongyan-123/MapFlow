import {useIdentity} from '../domains/identity/IdentityContext';
import type {Navigate} from '../app/useLocation';
import GlobalAssistantWorkspace from '../features/global-assistant/GlobalAssistantWorkspace';
export default function AssistantPage({navigate}:{navigate:Navigate}){
  const {session}=useIdentity();if(!session)return null;
  return <GlobalAssistantWorkspace key={session.account.playerId} accountId={session.account.playerId} csrfToken={session.csrfToken} navigate={navigate} />;
}
