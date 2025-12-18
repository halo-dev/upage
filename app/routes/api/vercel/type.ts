export type VercelAlias = {
  uid?: string;
  alias: string;
  created?: string;
  redirect?: string;
  oldDeploymentId?: string;
};

export type VercelResponseAliases = {
  aliases: VercelAlias[];
};

export type VercelResponseError = {
  error?: {
    code?: string;
    message?: string;
    saml?: boolean;
    teamId?: string | null;
    scope?: string;
    enforced?: boolean;
  };
};
