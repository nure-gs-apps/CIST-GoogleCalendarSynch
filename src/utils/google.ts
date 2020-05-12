import { JWTInput, Compute, JWT, UserRefreshClient } from 'google-auth-library';
import { google } from 'googleapis';
import { noop } from 'lodash';

export type OnError = (error: any) => any;

export function getAuthWithFallback(
  key: JWTInput, scopes: string | string[], onError?: OnError
): Promise<Compute | JWT | UserRefreshClient>;
export function getAuthWithFallback(
  keyFilePath: string, scopes: string | string[], onError?: OnError
): Promise<Compute | JWT | UserRefreshClient>;
export async function getAuthWithFallback(
  key: JWTInput | string, scopes: string | string[], onError = noop
): Promise<Compute | JWT | UserRefreshClient> {
  try {
    return await getAuth(key as any, scopes);
  } catch (error) {
    onError(error);
    return getAuth(scopes);
  }
}

export function getAuth(
  key: JWTInput, scopes: string | string[]
): Promise<Compute | JWT | UserRefreshClient>;
export function getAuth(
  keyFilePath: string, scopes: string | string[]
): Promise<Compute | JWT | UserRefreshClient>;
export function getAuth(
  scopes: string | string[]
): Promise<Compute | JWT | UserRefreshClient>;
export function getAuth(
  keyOrScopes: JWTInput | string | string[], scopes?: string | string[]
): Promise<Compute | JWT | UserRefreshClient> {
  const noKey = Array.isArray(keyOrScopes) || !scopes;
  if (noKey) {
    return google.auth.getClient();
  }
  if (typeof keyOrScopes === 'string') {
    return new google.auth.GoogleAuth({
      keyFilename: keyOrScopes,
    }).getClient();
  }
  return Promise.resolve(google.auth.fromJSON(keyOrScopes as JWTInput));
}
