import { inject, injectable } from 'inversify';
import { google } from 'googleapis';
import { Nullable } from '../../@types';
import { ASYNC_INIT, TYPES } from '../../di/types';
import { adminAuthScopes } from './constants';
import { IGoogleAuth } from './interfaces';

@injectable()
export class GoogleAdminAuth implements IGoogleAuth {
  readonly [ASYNC_INIT]: Promise<any>;
  private _authClient: Nullable<any>;

  get authClient() {
    return this._authClient;
  }

  constructor(
    @inject(TYPES.GoogleAuthSubject) subject: string,
    @inject(TYPES.GoogleAuthAdminKeyFilepath) keyFilepath: string,
  ) {
    this[ASYNC_INIT] = google.auth.getClient({
      scopes: adminAuthScopes.slice(),
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
