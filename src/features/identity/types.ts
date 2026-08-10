export interface IdentityCapabilities {
  identity: {
    registrationEnabled: boolean;
  };
}

export interface PublicAccount {
  playerId: string;
  username: string;
  status: 'active';
}

export interface IdentitySession {
  account: PublicAccount;
  csrfToken: string;
}

export interface RegistrationInput {
  username: string;
  password: string;
  invitationCode: string;
  email?: string;
  phone?: string;
}

export interface LoginInput {
  username: string;
  password: string;
}
