import IdentityDialog from './IdentityDialog';
import { useIdentity } from './IdentityContext';
import type { LoginInput, RegistrationInput } from './types';

interface IdentityGateProps {
  onAuthenticated: () => void;
}

export default function IdentityGate({ onAuthenticated }: IdentityGateProps) {
  const {
    authenticationPending,
    authenticationError,
    resetAuthenticationError,
    authenticateLogin,
    authenticateRegistration,
    claimInvitation,
  } = useIdentity();

  const handleLogin = async (input: LoginInput) => {
    await authenticateLogin(input);
    onAuthenticated();
  };

  const handleRegistration = async (input: RegistrationInput) => {
    await authenticateRegistration(input);
    onAuthenticated();
  };

  return (
    <IdentityDialog
      presentation="page"
      pending={authenticationPending}
      requestError={authenticationError}
      onClose={() => undefined}
      onResetError={resetAuthenticationError}
      onLogin={handleLogin}
      onRegister={handleRegistration}
      onClaimInvitation={claimInvitation}
    />
  );
}
