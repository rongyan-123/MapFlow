import type { ReactNode } from 'react';
import { IdentityProvider as DomainIdentityProvider, useIdentity } from '../../domains/identity/IdentityContext';
import IdentityDialog from './IdentityDialog';

export { useIdentity, CAPABILITIES_QUERY_KEY, SESSION_QUERY_KEY } from '../../domains/identity/IdentityContext';

// Kept while the old entry remains reachable during the page migration.
function LegacyIdentityDialogHost() {
  const identity = useIdentity();
  if (!identity.identityEnabled || !identity.dialogOpen) return null;
  return <IdentityDialog pending={identity.authenticationPending} requestError={identity.authenticationError}
    onClose={identity.closeIdentityDialog} onResetError={identity.resetAuthenticationError}
    onLogin={identity.authenticateLogin} onRegister={identity.authenticateRegistration}
    onClaimInvitation={identity.claimInvitation} />;
}

export function IdentityProvider({ children }: { children: ReactNode }) {
  return <DomainIdentityProvider>{children}<LegacyIdentityDialogHost /></DomainIdentityProvider>;
}
