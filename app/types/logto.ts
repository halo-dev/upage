// Logto 用户身份信息
export interface LogtoUserIdentity {
  userId: string;
  details: Record<string, any>;
}

export interface LogtoUserAddress {
  formatted?: string;
  streetAddress?: string;
  locality?: string;
  region?: string;
  postalCode?: string;
  country?: string;
}

export interface LogtoUserProfile {
  familyName?: string;
  givenName?: string;
  middleName?: string;
  nickname?: string;
  preferredUsername?: string;
  profile?: string;
  website?: string;
  gender?: string;
  birthdate?: string;
  zoneinfo?: string;
  locale?: string;
  address?: LogtoUserAddress;
}

// Logto SSO 身份信息
export interface LogtoSsoIdentity {
  tenantId: string;
  id: string;
  userId: string;
  issuer: string;
  identityId: string;
  detail: Record<string, any>;
  createdAt: number;
  updatedAt: number;
  ssoConnectorId: string;
}

export interface LogtoUser {
  id: string;
  username: string | null;
  primaryEmail: string | null;
  primaryPhone: string | null;
  name: string | null;
  avatar: string | null;
  customData: Record<string, any>;
  identities: Record<string, LogtoUserIdentity>;
  lastSignInAt: number | null;
  createdAt: number;
  updatedAt: number;
  profile: LogtoUserProfile;
  applicationId: string | null;
  isSuspended: boolean;
  hasPassword?: boolean;
  ssoIdentities?: LogtoSsoIdentity[];
}
