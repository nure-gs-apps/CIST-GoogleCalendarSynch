import { google } from 'googleapis';
import { inject, injectable } from 'inversify';
import { Nullable } from '../../@types';
import { ASYNC_INIT, TYPES } from '../../di/types';
import { calenderAuthScopes } from './constants';
import { IGoogleAuth } from './interfaces';

@injectable()
export class GoogleCalendarAuth implements IGoogleAuth {
  readonly [ASYNC_INIT]: Promise<any>;
  private _authClient: Nullable<any>;

  get authClient() {
    return this._authClient;
  }

  constructor(
    @inject(TYPES.GoogleAuthSubject) subject: string,
    @inject(TYPES.GoogleAuthCalendarKeyFilepath) keyFilepath: string,
  ) {
    this[ASYNC_INIT] = google.auth.getClient({
      scopes: calenderAuthScopes.slice(),
      keyFilename: keyFilepath,
      clientOptions: {
        subject,
      },
    });
    this._authClient = null;
    this[ASYNC_INIT]
      .then(authClient => this._authClient = authClient);
  }
}
