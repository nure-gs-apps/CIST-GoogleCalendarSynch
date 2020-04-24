import { ReadonlyDate } from 'readonly-date';
import { Nullable } from '../../@types';
import { CacheUtilsService } from '../cache-utils.service';
import { CachedValueSource } from '../caching/cached-value-source';
import { CistJsonHttpClient } from './cist-json-http-client.service';
import { ApiAuditoriesResponse } from './types';

export class CistJsonHttpRoomsCachedValue extends CachedValueSource<ApiAuditoriesResponse> {
  protected readonly _http: CistJsonHttpClient;

  constructor(
    cacheUtils: CacheUtilsService,
    http: CistJsonHttpClient,
  ) {
    super(cacheUtils);
    this._http = http;
  }

  // tslint:disable-next-line:max-line-length
  protected doLoadFromCache(): Promise<[Nullable<ApiAuditoriesResponse>, ReadonlyDate]> {
    return this._http.getRoomsResponse()
      .then(response => [response, this._utils.getMaxExpiration()]);
  }
}
