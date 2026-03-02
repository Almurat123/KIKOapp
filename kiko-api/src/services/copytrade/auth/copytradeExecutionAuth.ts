export interface CopytradeExecutionAuth {
  mode: 'client_access_token' | 'server_privy';
  accessToken: string;
  canCollectDirectSwapFee: boolean;
  reasonCode: 'client_access_token' | 'server_privy_copytrade' | 'missing_access_token';
}

export function resolveCopytradeExecutionAuth(params: {
  mode: string;
  accessToken?: string;
}): CopytradeExecutionAuth {
  const accessToken = String(params.accessToken || '').trim();
  if (accessToken) {
    return {
      mode: 'client_access_token',
      accessToken,
      canCollectDirectSwapFee: true,
      reasonCode: 'client_access_token'
    };
  }

  if (params.mode === 'copytrade') {
    return {
      mode: 'server_privy',
      accessToken: '',
      canCollectDirectSwapFee: true,
      reasonCode: 'server_privy_copytrade'
    };
  }

  return {
    mode: 'server_privy',
    accessToken: '',
    canCollectDirectSwapFee: false,
    reasonCode: 'missing_access_token'
  };
}
