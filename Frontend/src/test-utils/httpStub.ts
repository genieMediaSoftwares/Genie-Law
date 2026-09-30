// Test-only: replaces Axios's network adapter so tests decide every response.
// Import this before any module that creates an Axios instance (instances copy
// the adapter when they are created).
import axios, { AxiosError, AxiosHeaders } from 'axios';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';

export type StubReply =
  | { status: number; data?: unknown }
  | { networkError: 'ERR_NETWORK' | 'ECONNABORTED' | 'ETIMEDOUT' };

export type StubHandler = (config: InternalAxiosRequestConfig) => StubReply | Promise<StubReply>;

let handler: StubHandler = () => {
  throw new Error('No HTTP stub handler set for this test.');
};

export const requests: InternalAxiosRequestConfig[] = [];

export const setHttpHandler = (next: StubHandler): void => {
  handler = next;
};

export const resetHttpStub = (): void => {
  requests.length = 0;
};

export const authHeaderOf = (config: InternalAxiosRequestConfig): string | undefined => {
  const value = AxiosHeaders.from(config.headers).get('Authorization');
  return value ? String(value) : undefined;
};

axios.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
  requests.push(config);
  const reply = await handler(config);
  if ('networkError' in reply) {
    throw new AxiosError('stubbed network failure', reply.networkError, config, {});
  }
  const response: AxiosResponse = {
    data: reply.data,
    status: reply.status,
    statusText: String(reply.status),
    headers: {},
    config,
  };
  if (reply.status >= 200 && reply.status < 300) {
    return response;
  }
  throw new AxiosError(
    `Request failed with status code ${reply.status}`,
    reply.status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST,
    config,
    {},
    response,
  );
};
