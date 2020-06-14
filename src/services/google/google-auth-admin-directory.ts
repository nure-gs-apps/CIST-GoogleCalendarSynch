import { inject, injectable } from 'inversify';
import { Nullable } from '../../@types';
import { ILogger } from '../../@types/logging';
import { ASYNC_INIT, IAsyncInitializable } from '../../@types/object';
import { GoogleAuthConfigKey } from '../../config/types';
import { TYPES } from '../../di/types';
import { adminDirectoryAuthScopes } from './constants';
import {
  addDefaultScopes,
  AnyGoogleAuthClient, createAuth,
  createAuthWithFallback,
  IGoogleAuth, setDefaultSubject,
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
    ) key: GoogleAuthConfigKey,
    @inject(
      TYPES.GoogleAuthAdminSubject
    ) subject: string,
  ) {
    this._authClient = null;
    setDefaultSubject(subject);
    this[ASYNC_INIT] = (key ? createAuthWithFallback(
      key,
      adminDirectoryAuthScopes.slice(),
      subject,
      (error, keyPath) => {
        if (keyPath) {
          logger.warn(l(`Failed to load key from file "${keyPath}" due to error:`), error);
        } else {
          logger.warn(l('Error while loading key due to error:'), error);
        }
      }
    ) : createAuth()).then(c => this._authClient = c);
  }
}

function l(message: string) {
  return `${GoogleAuthAdminDirectory.name} ${message}`;
}
