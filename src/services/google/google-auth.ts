import * as appRootPath from 'app-root-path';
import { Compute, JWT, JWTInput, UserRefreshClient } from 'google-auth-library';
import { GoogleAuthOptions } from 'google-auth-library/build/src/auth/googleauth';
import { google } from 'googleapis';
import { AuthPlus } from 'googleapis/build/src/googleapis';
import { noop } from 'lodash';
import * as path from 'path';
import { Optional } from '../../@types';
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

let defaultSubject: Optional<string>;
export function setDefaultSubject(value: Optional<string>) {
  defaultSubject = value;
}

export async function createAuthWithFallback(
  key: GoogleAuthKey,
  scopes: string | string[],
  subject?: string,
  onError: OnError = noop,
): Promise<AnyGoogleAuthClient> {
  if (typeof key === 'string' && !path.isAbsolute(key)) {
    let filePath = path.resolve(key);
    try {
      return await createAuth(filePath, scopes, subject);
    } catch (error) {
      filePath = appRootPath.resolve(key);
      try {
        return await createAuth(filePath, scopes, subject);
      } catch (error) {
        onError(error, filePath);
        return createAuth();
      }
    }
  }
  try {
    return await createAuth(key, scopes, subject);
  } catch (error) {
    onError(error);
    return createAuth();
  }
}

export function createAuth(
  key: GoogleAuthKey, scopes: string | string[], subject?: string
): Promise<AnyGoogleAuthClient>;
export function createAuth(): Promise<AnyGoogleAuthClient>;
export function createAuth(
  key?: JWTInput | string, scopes?: string | string[], subject?: string
): Promise<AnyGoogleAuthClient> {
  if (!key) {
    const options: GoogleAuthOptions = {
      scopes: defaultScopes
    };
    if (defaultSubject !== undefined) {
      options.clientOptions = {
        subject: defaultSubject
      };
    }
    return google.auth.getClient(options);
  }
  if (typeof key === 'string') {
    const options: GoogleAuthOptions = {
      scopes,
      keyFilename: key
    };
    if (subject !== undefined) {
      options.clientOptions = {
        subject,
      };
    }
    return new AuthPlus(options).getClient();
  }
  const client = google.auth.fromJSON(key);
  (client as any).scopes = scopes; // as per docs: https://github.com/googleapis/google-auth-library-nodejs/tree/v6.0.0#loading-credentials-from-environment-variables
  if (subject !== undefined) {
    (client as any).subject = subject;
  }
  return Promise.resolve(client);
}
