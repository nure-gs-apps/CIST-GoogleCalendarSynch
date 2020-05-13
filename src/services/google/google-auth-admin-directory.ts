import { inject, injectable } from 'inversify';
import { Nullable } from '../../@types';
import { ILogger } from '../../@types/logging';
import { ASYNC_INIT, IAsyncInitializable } from '../../@types/object';
import { AppConfig } from '../../config/types';
import { TYPES } from '../../di/types';
import { adminDirectoryAuthScopes } from './constants';
import {
  addDefaultScopes,
  AnyGoogleAuthClient,
  createAuthWithFallback,
  IGoogleAuth,
} from './google-auth';

addDefaultScopes(adminDirectoryAuthScopes);
@injectable()
export class GoogleAuthAdminDirectory implements IAsyncInitializable, IGoogleAuth {
  readonly [ASYNC_INIT]: Promise<any>;
  private _authClient: Nullable<AnyGoogleAuthClient>;

  get authClient() {
    if (!this._authClient) {
      throw new TypeError(l('is not initialized!'));
    }
    return this._authClient;
  }

  constructor(
    @inject(TYPES.Logger) logger: ILogger,
    @inject(
      TYPES.GoogleAuthAdminDirectoryKey
    ) key: AppConfig['google']['auth']['adminDirectoryKey'],
  ) {
    this._authClient = null;
    this[ASYNC_INIT] = createAuthWithFallback(
      key as any,
      adminDirectoryAuthScopes.slice(),
      (error, keyPath) => {
        if (keyPath) {
          logger.warn(l(`Failed to load key from file "${keyPath}" due to error:`), error);
        } else {
          logger.warn(l('Error while loading key due to error:'), error);
        }
      }
    ).then(c => this._authClient = c);
  }
}

function l(message: string) {
  return `${GoogleAuthAdminDirectory.name} ${message}`;
}
