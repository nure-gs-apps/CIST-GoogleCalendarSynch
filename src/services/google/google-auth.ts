import { Compute, JWT, JWTInput, UserRefreshClient } from 'google-auth-library';
import { inject, injectable } from 'inversify';
import { google } from 'googleapis';
import { noop } from 'lodash';
import * as path from 'path';
import { Nullable } from '../../@types';
import { ASYNC_INIT, IAsyncInitializable } from '../../@types/object';
import { TYPES } from '../../di/types';
import { IGoogleAuth } from './types';
import * as appRootPath from 'app-root-path';

@injectable()
export class GoogleAuth implements IGoogleAuth, IAsyncInitializable {
  readonly [ASYNC_INIT]: Promise<any>;
  private _authClient: Nullable<any>;

  get authClient() {
    return this._authClient;
  }

  constructor(
    @inject(TYPES.GoogleAuthSubject) subject: string,
    @inject(TYPES.GoogleAuthKeyFilepath) keyFilepath: string,
    @inject(TYPES.GoogleAuthScopes) scopes: ReadonlyArray<string>,
  ) {
    this[ASYNC_INIT] = google.auth.getClient({
      scopes: scopes.slice(),
      keyFilename: keyFilepath,
      clientOptions: {
        subject,
      },
    }) as Promise<any>;
    this._authClient = null;
    this[ASYNC_INIT]
      .then(authClient => this._authClient = authClient);
  }
}

export type OnError = (error: any, keyFilePath?: string) => any;

let defaultScopes: string[] = [];
export function clearDefaultScopes() {
  defaultScopes = [];
}
export function addDefaultScopes(newScopes: string[]) {
  defaultScopes = defaultScopes.concat(newScopes);
}

export function createAuthWithFallback(
  key: JWTInput, scopes: string | string[], onError?: OnError
): Promise<Compute | JWT | UserRefreshClient>;
export function createAuthWithFallback(
  keyFilePath: string, scopes: string | string[], onError?: OnError
): Promise<Compute | JWT | UserRefreshClient>;
export async function createAuthWithFallback(
  key: JWTInput | string, scopes: string | string[], onError = noop
): Promise<Compute | JWT | UserRefreshClient> {
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
    return await createAuth(key as any, scopes);
  } catch (error) {
    onError(error);
    return createAuth();
  }
}

export function createAuth(
  key: JWTInput, scopes: string | string[]
): Promise<Compute | JWT | UserRefreshClient>;
export function createAuth(
  keyFilePath: string, scopes: string | string[]
): Promise<Compute | JWT | UserRefreshClient>;
export function createAuth(): Promise<Compute | JWT | UserRefreshClient>;
export function createAuth(
  key?: JWTInput | string, scopes?: string | string[]
): Promise<Compute | JWT | UserRefreshClient> {
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
