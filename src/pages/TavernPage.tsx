import {useIdentity} from '../domains/identity/IdentityContext';
import type {Navigate} from '../app/useLocation';
import SceneWorkspace from './SceneWorkspace';
export default function TavernPage({navigate}:{navigate:Navigate}){
  const {session}=useIdentity();if(!session)return null;
  return <SceneWorkspace key={session.account.playerId} owner={{accountId:session.account.playerId,csrfToken:session.csrfToken,userName:session.account.username,scene:'tavern'}} navigate={navigate} />;
}
