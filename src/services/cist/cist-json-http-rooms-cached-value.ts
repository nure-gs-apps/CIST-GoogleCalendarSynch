import { ReadonlyDate } from 'readonly-date';
import { Nullable } from '../../@types';
import { CacheUtilsService } from '../cache-utils.service';
import { CachedValue } from '../caching/cached-value';
import { CistJsonHttpClient } from './cist-json-http-client.service';
import { CistJsonHttpUtilsService } from './cist-json-http-utils.service';
import { ApiAuditoriesResponse } from './types';

export class CistJsonHttpRoomsCachedValue extends CachedValue<ApiAuditoriesResponse> {
  protected readonly needsInit = false;
  readonly needsSource = false;
  protected readonly _http: CistJsonHttpClient;
  protected readonly _cistUtils: CistJsonHttpUtilsService;

  constructor(
    cacheUtils: CacheUtilsService,
    http: CistJsonHttpClient,
    cistUtils: CistJsonHttpUtilsService
  ) {
    super(cacheUtils);
    this._http = http;
    this._cistUtils = cistUtils;
  }

  // tslint:disable-next-line:max-line-length
  protected doLoadValue(): Promise<[Nullable<ApiAuditoriesResponse>, ReadonlyDate]> {
    return this._http.axios
      .get(CistJsonHttpClient.ROOMS_PATH)
      .then(response => [
        this._cistUtils.parseAuditoriesResponse(response),
        this._utils.getMaxExpiration()
      ]);
  }
}
