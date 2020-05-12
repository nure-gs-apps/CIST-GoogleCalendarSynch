import { ReadonlyDate } from 'readonly-date';
import { Nullable } from '../../@types';
import { CacheUtilsService } from '../caching/cache-utils.service';
import { CachedValueSource } from '../caching/cached-value-source';
import { CistJsonHttpClient } from './cist-json-http-client.service';
import { ApiGroupsResponse } from '../../@types/cist';

export class CistJsonHttpGroupsCachedValue extends CachedValueSource<ApiGroupsResponse> {
  protected readonly _http: CistJsonHttpClient;

  constructor(
    cacheUtils: CacheUtilsService,
    http: CistJsonHttpClient,
  ) {
    super(cacheUtils);
    this._http = http;
  }

  // tslint:disable-next-line:max-line-length
  protected doLoadFromCache(): Promise<[Nullable<ApiGroupsResponse>, ReadonlyDate]> {
    return this._http.getGroupsResponse()
      .then(response => [response, this._utils.getMaxExpiration()]);
  }
}
