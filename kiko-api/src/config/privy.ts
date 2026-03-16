export interface ResolvedPrivyServerConfig {
  appId: string;
  appSecret: string;
  frontendAppId: string;
  appIdMismatch: boolean;
}

export function resolvePrivyServerConfig(env: NodeJS.ProcessEnv = process.env): ResolvedPrivyServerConfig {
  const appId = String(env.PRIVY_APP_ID || '').trim();
  const appSecret = String(env.PRIVY_APP_SECRET || '').trim();
  const frontendAppId = String(env.VITE_PRIVY_APP_ID || '').trim();

  return {
    appId,
    appSecret,
    frontendAppId,
    appIdMismatch: Boolean(appId && frontendAppId && appId !== frontendAppId),
  };
}
