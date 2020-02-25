import { ReadonlyDate } from 'readonly-date';
import { DeepReadonly, Nullable } from '../../@types';
import { dateToSeconds } from '../../utils/common';
import { CacheUtilsService } from '../cache-utils.service';
import { CachedValue } from '../caching/cached-value';
import { CistJsonHttpClient } from './cist-json-http-client.service';
import { CistJsonHttpUtilsService } from './cist-json-http-utils.service';
import {
  ApiEventsResponse,
  IEventsQueryParams, TimetableType,
} from './types';

interface IQueryParams {
  type_id: TimetableType;
  timetable_id: string | number;
  time_from?: number;
  time_to?: number;
}

function cloneQueryParams(params: IQueryParams) {
  const newParams = {
    type_id: params.type_id,
    timetable_id: params.timetable_id
  } as IQueryParams;
  if (params.time_from) {
    newParams.time_from = params.time_from;
  }
  if (params.time_to) {
    newParams.time_to = params.time_to;
  }
  return newParams;
}

export class CistJsonHttpGroupsCachedValue extends CachedValue<ApiEventsResponse> {
  protected readonly needsInit = false;
  readonly needsSource = false;
  readonly params: DeepReadonly<IEventsQueryParams>;
  protected readonly _http: CistJsonHttpClient;
  protected readonly _cistUtils: CistJsonHttpUtilsService;
  protected readonly _queryParams: IQueryParams;

  constructor(
    cacheUtils: CacheUtilsService,
    http: CistJsonHttpClient,
    cistUtils: CistJsonHttpUtilsService,
    params: DeepReadonly<IEventsQueryParams>
  ) {
    super(cacheUtils);
    this._http = http;
    this._cistUtils = cistUtils;
    this.params = params;
    this._queryParams = {
      type_id: this.params.typeId,
      timetable_id: this.params.entityId,
    };
    if (this.params.dateLimits) {
      if (this.params.dateLimits.from) {
        this._queryParams.time_from = dateToSeconds(
          this.params.dateLimits.from
        );
      }
      if (this.params.dateLimits.to) {
        this._queryParams.time_to = dateToSeconds(this.params.dateLimits.to);
      }
    }
  }

  // tslint:disable-next-line:max-line-length
  protected doLoadValue(): Promise<[Nullable<ApiEventsResponse>, ReadonlyDate]> {
    return this._http.axios
      .get(CistJsonHttpClient.EVENTS_PATH)
      .then(response => [
        this._cistUtils.parseEventsResponse(response),
        this._utils.getMaxExpiration()
      ]);
  }
}
