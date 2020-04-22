import { promises as fs } from 'fs';
import { inject, injectable, optional } from 'inversify';
import * as path from 'path';
import {
  ASYNC_INIT,
  DeepReadonly,
  IAsyncInitializable, IDisposable, Nullable,
  Optional,
} from '../../@types';
import { CacheType, CistCacheConfig } from '../../config/types';
import { TYPES } from '../../di/types';
import { dateToSeconds, isWindows, PathUtils } from '../../utils/common';
import { CacheUtilsService } from '../cache-utils.service';
import { IReadonlyCachedValue } from '../caching/cached-value';
import { FileCachedValue } from '../caching/file-cached-value';
import { CistJsonHttpClient } from './cist-json-http-client.service';
import { CistJsonHttpGroupsCachedValue } from './cist-json-http-groups-cached-value';
import { CistJsonHttpRoomsCachedValue } from './cist-json-http-rooms-cached-value';
import {
  ApiAuditoriesResponse,
  ApiEventsResponse,
  ApiGroupsResponse,
  ICistJsonClient,
  IDateLimits,
  IEventsQueryParams,
  TimetableType,
} from './types';

enum RequestType {
  Events= 'events',
  Groups = 'groups',
  Rooms = 'rooms'
}

@injectable()
export class CachedCistJsonClientService implements ICistJsonClient, IAsyncInitializable, IDisposable {
  readonly [ASYNC_INIT]: Promise<any>;
  private readonly _cacheConfig: DeepReadonly<CistCacheConfig>;
  private readonly _cacheUtils: CacheUtilsService;
  private readonly _baseDirectory: string;
  private readonly _http: Nullable<CistJsonHttpClient>;
  // tslint:disable-next-line:max-line-length
  private readonly _eventsCachedValues: Map<string, IReadonlyCachedValue<ApiEventsResponse>>;
  // tslint:disable-next-line:max-line-length
  private _groupsCachedValue: Nullable<IReadonlyCachedValue<ApiGroupsResponse>>;
  // tslint:disable-next-line:max-line-length
  private _roomsCachedValue: Nullable<IReadonlyCachedValue<ApiAuditoriesResponse>>;

  constructor(
    @inject(TYPES.CacheUtils) cacheUtils: CacheUtilsService,
    @inject(TYPES.CistCacheConfig) cacheConfig: DeepReadonly<CistCacheConfig>,
    // tslint:disable-next-line:max-line-length
    @inject(TYPES.CistJsonHttpClient) @optional() http: Optional<CistJsonHttpClient>
  ) {
    this._cacheConfig = cacheConfig;
    this._cacheUtils = cacheUtils;
    this._eventsCachedValues = new Map();
    this._groupsCachedValue = null;
    this._roomsCachedValue = null;

    this[ASYNC_INIT] = Promise.resolve();

    // File cache
    if (this.includesCache(CacheType.File)) {
      this._baseDirectory = path.resolve(path.join(
        PathUtils.expandVars(isWindows()
          ? this._cacheConfig.configs[CacheType.File].location.win
          : this._cacheConfig.configs[CacheType.File].location.unix),
        PathUtils.expandVars(
          this._cacheConfig.configs[CacheType.File].subDirectory
        )
      ));
      this[ASYNC_INIT] = this[ASYNC_INIT]
        .then(() => fs.mkdir(this._baseDirectory, { recursive: true }));
    } else {
      this._baseDirectory = '.';
    }

    // HTTP source
    if (this.includesCache(CacheType.Http)) {
      if (!http) {
        throw new TypeError('Cist http client is not found!');
      }
      this._http = http;
    } else {
      this._http = null;
    }
  }

  getEventsResponse(
    type: TimetableType,
    entityId: number | string,
    dateLimits?: DeepReadonly<IDateLimits>
  ): Promise<ApiEventsResponse> {
    return Promise.resolve(undefined);
  }

  async getGroupsResponse(): Promise<ApiGroupsResponse> {
    if (!this._groupsCachedValue) {
      const cachedValue = new FileCachedValue<ApiGroupsResponse>(
        this._cacheUtils, getCacheFileName(RequestType.Groups)
      );
      if (cachedValue.needsInit) {
        await cachedValue.init();
      }
      if (this._http) {
        const httpClient = new CistJsonHttpGroupsCachedValue(
          this._cacheUtils,
          this._http
        );
        if (cachedValue.needsInit) {
          await cachedValue.init();
        }
        await cachedValue.setSource(httpClient);
      }
      this._groupsCachedValue = cachedValue;
    }
    const response = await this._groupsCachedValue.loadValue();
    if (!response) {
      throw new TypeError(`${this.getEventsResponse.name} failed to find value in cache chain!`);
    }
    return response;
  }

  async getRoomsResponse(): Promise<ApiAuditoriesResponse> {
    if (!this._roomsCachedValue) {
      const cachedValue = new FileCachedValue<ApiAuditoriesResponse>(
        this._cacheUtils, getCacheFileName(RequestType.Groups)
      );
      if (cachedValue.needsInit) {
        await cachedValue.init();
      }
      if (this._http) {
        const httpClient = new CistJsonHttpRoomsCachedValue(
          this._cacheUtils,
          this._http
        );
        if (cachedValue.needsInit) {
          await cachedValue.init();
        }
        await cachedValue.setSource(httpClient);
      }
      this._roomsCachedValue = cachedValue;
    }
    const response = await this._roomsCachedValue.loadValue();
    if (!response) {
      throw new TypeError(`${this.getEventsResponse.name} failed to find value in cache chain!`);
    }
    return response;
  }

  private includesCache(type: CacheType) {
    return this._cacheConfig.priorities.auditories.includes(type)
      || this._cacheConfig.priorities.events.includes(type)
      || this._cacheConfig.priorities.groups.includes(type);
  }
}

const separator = '.';
function getCacheFileName(
  type: RequestType.Events,
  options: IEventsQueryParams
): string;
function getCacheFileName(type: RequestType.Groups | RequestType.Rooms): string;
function getCacheFileName(type: RequestType, options?: IEventsQueryParams) {
  let hash = type.toString();
  if (options) {
    hash += getEventsCacheFileNamePart(options);
  }
  return hash;
}

function getEventsCacheFileNamePart(options: IEventsQueryParams) {
  let hash = options.typeId.toString() + separator + options.entityId;
  if (options.dateLimits) {
    hash += separator;
    if (options.dateLimits.from) {
      hash += dateToSeconds(options.dateLimits.from);
    }
    if (options.dateLimits.to) {
      hash += separator + dateToSeconds(options.dateLimits.to);
    }
  }
  return `${hash}.tmp`;
}
