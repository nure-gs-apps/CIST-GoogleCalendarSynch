import { ReadonlyDate } from 'readonly-date';
import { DeepReadonly, Nullable } from '../../@types';
import { CacheUtilsService } from '../cache-utils.service';
import { CachedValueSource } from '../caching/cached-value-source';
import { CistJsonHttpClient } from './cist-json-http-client.service';
import {
  ApiEventsResponse,
  IEventsQueryParams,
} from './types';

export class CistJsonHttpEventsCachedValue extends CachedValueSource<ApiEventsResponse> {
  readonly params: DeepReadonly<IEventsQueryParams>;
  protected readonly _http: CistJsonHttpClient;

  constructor(
    cacheUtils: CacheUtilsService,
    http: CistJsonHttpClient,
    params: DeepReadonly<IEventsQueryParams>
  ) {
    super(cacheUtils);
    this._http = http;
    this.params = params;
  }

  // tslint:disable-next-line:max-line-length
  protected doLoadFromCache(): Promise<[Nullable<ApiEventsResponse>, ReadonlyDate]> {
    return this._http.getEventsResponse(
      this.params.typeId,
      this.params.entityId,
      this.params.dateLimits
    ).then(response => [response, this._utils.getMaxExpiration()]);
  }
}
