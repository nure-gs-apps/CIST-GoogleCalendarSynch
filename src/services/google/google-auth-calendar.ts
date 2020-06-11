import { inject, injectable } from 'inversify';
import { Nullable } from '../../@types';
import { ILogger } from '../../@types/logging';
import { ASYNC_INIT, IAsyncInitializable } from '../../@types/object';
import { GoogleAuthConfigKey } from '../../config/types';
import { TYPES } from '../../di/types';
import { calendarAuthScopes } from './constants';
import {
  addDefaultScopes,
  AnyGoogleAuthClient, createAuth,
  createAuthWithFallback,
  IGoogleAuth,
} from './google-auth';

addDefaultScopes(calendarAuthScopes);
@injectable()
export class GoogleAuthCalendar implements IAsyncInitializable, IGoogleAuth {
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
      TYPES.GoogleAuthCalendarKey
    ) key: GoogleAuthConfigKey,
    @inject(
      TYPES.GoogleAuthSubject
    ) subject: string,
  ) {
    this._authClient = null;
    // setDefaultSubject(subject);
    this[ASYNC_INIT] = (key ? createAuthWithFallback(
      key,
      calendarAuthScopes.slice(),
      undefined, // subject,
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
  return `${GoogleAuthCalendar.name} ${message}`;
}
