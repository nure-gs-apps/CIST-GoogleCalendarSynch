import { ReadonlyDate } from 'readonly-date';
import { DeepReadonly, Nullable } from '../../@types';
import { CacheUtilsService } from '../caching/cache-utils.service';
import { CachedValueSource } from '../caching/cached-value-source';
import { CistJsonHttpClient } from './cist-json-http-client.service';
import {
  CistEventsResponse,
  IEventsQueryParams,
} from '../../@types/cist';

export class CistJsonHttpEventsCachedValue extends CachedValueSource<CistEventsResponse> {
  readonly isDestroyable = false;
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
  protected doLoadFromCache(): Promise<[Nullable<CistEventsResponse>, ReadonlyDate]> {
    return this._http.getEventsResponse(
      this.params.typeId,
      this.params.entityId,
      this.params.dateLimits
    ).then(response => [response, this._utils.getMaxExpiration()]);
  }
}
