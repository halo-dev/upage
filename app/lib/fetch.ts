type CommonRequest = Omit<RequestInit, 'body'> & { body?: URLSearchParams | FormData | string };

export async function request(url: string, init?: CommonRequest) {
  const nodeFetch = await import('node-fetch');
  const https = await import('node:https');

  const agent = url.startsWith('https') ? new https.Agent({ rejectUnauthorized: false }) : undefined;

  return nodeFetch.default(url, { ...init, agent });
}
