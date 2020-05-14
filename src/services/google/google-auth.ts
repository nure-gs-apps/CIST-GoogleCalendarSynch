import * as appRootPath from 'app-root-path';
import { Compute, JWT, JWTInput, UserRefreshClient } from 'google-auth-library';
import { google } from 'googleapis';
import { noop } from 'lodash';
import * as path from 'path';
import { GoogleAuthKey } from '../../@types/google';

export interface IGoogleAuth {
  readonly authClient: AnyGoogleAuthClient;
}

export type OnError = (error: any, keyFilePath?: string) => any;
export type AnyGoogleAuthClient = Compute | JWT | UserRefreshClient;

let defaultScopes: string[] = [];
export function clearDefaultScopes() {
  defaultScopes = [];
}
export function addDefaultScopes(newScopes: ReadonlyArray<string>) {
  defaultScopes = defaultScopes.concat(newScopes);
}

export async function createAuthWithFallback(
  key: GoogleAuthKey, scopes: string | string[], onError: OnError = noop
): Promise<AnyGoogleAuthClient> {
  if (typeof key === 'string' && !path.isAbsolute(key)) {
    let filePath = path.resolve(key);
    try {
      return await createAuth(filePath, scopes);
    } catch (error) {
      filePath = appRootPath.resolve(key);
      try {
        return await createAuth(filePath, scopes);
      } catch (error) {
        onError(error, filePath);
        return createAuth();
      }
    }
  }
  try {
    return await createAuth(key, scopes);
  } catch (error) {
    onError(error);
    return createAuth();
  }
}

export function createAuth(
  key: GoogleAuthKey, scopes: string | string[]
): Promise<AnyGoogleAuthClient>;
export function createAuth(): Promise<AnyGoogleAuthClient>;
export function createAuth(
  key?: JWTInput | string, scopes?: string | string[]
): Promise<AnyGoogleAuthClient> {
  if (!key) {
    return google.auth.getClient({
      scopes: defaultScopes
    });
  }
  if (typeof key === 'string') {
    return new google.auth.GoogleAuth({
      scopes,
      keyFilename: key,
    }).getClient();
  }
  const client = google.auth.fromJSON(key);
  (client as any).scopes = scopes; // as per docs: https://github.com/googleapis/google-auth-library-nodejs/tree/v6.0.0#loading-credentials-from-environment-variables
  return Promise.resolve(client);
}
