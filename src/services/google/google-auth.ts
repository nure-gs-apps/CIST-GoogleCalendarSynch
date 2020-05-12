import { inject, injectable } from 'inversify';
import { google } from 'googleapis';
import { Nullable } from '../../@types';
import { ASYNC_INIT, IAsyncInitializable } from '../../@types/object';
import { TYPES } from '../../di/types';
import { IGoogleAuth } from './types';

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
