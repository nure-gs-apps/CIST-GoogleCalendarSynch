import { promises as fs } from 'fs';
import { inject, injectable, optional } from 'inversify';
import * as path from 'path';
import {
  ASYNC_INIT,
  DeepReadonly,
  IAsyncInitializable,
  IDisposable,
  Nullable,
  Optional,
} from '../../@types';
import { CacheType, CistCacheConfig } from '../../config/types';
import { TYPES } from '../../di/types';
import { MultiError, NestedError } from '../../errors';
import { includesCache } from '../../utils/cist';
import {
  dateToSeconds, destroyChain,
  disposeChain,
  isWindows,
  PathUtils,
} from '../../utils/common';
import { CacheUtilsService } from '../cache-utils.service';
import { CachedValue } from '../caching/cached-value';
import { FileCachedValue } from '../caching/file-cached-value';
import { CistJsonHttpClient } from './cist-json-http-client.service';
import { CistJsonHttpEventsCachedValue } from './cist-json-http-events-cached-value';
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
  get isDisposed() {
    return this._isDisposed;
  }
  private _isDisposed: boolean;
  private readonly _cacheConfig: DeepReadonly<CistCacheConfig>;
  private readonly _cacheUtils: CacheUtilsService;
  private readonly _baseDirectory: string;
  private readonly _http: Nullable<CistJsonHttpClient>;
  // tslint:disable-next-line:max-line-length
  private readonly _eventsCachedValues: Map<string, CachedValue<ApiEventsResponse>>;
  // tslint:disable-next-line:max-line-length
  private _groupsCachedValue: Nullable<CachedValue<ApiGroupsResponse>>;
  // tslint:disable-next-line:max-line-length
  private _roomsCachedValue: Nullable<CachedValue<ApiAuditoriesResponse>>;

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
    this._isDisposed = false;

    this[ASYNC_INIT] = Promise.resolve();

    // File cache
    if (this.includesCache(CacheType.File)) {
      this._baseDirectory = path.resolve(PathUtils.expandVars(isWindows()
        ? this._cacheConfig.configs[CacheType.File].directory.win
        : this._cacheConfig.configs[CacheType.File].directory.unix),
      );
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

  async dispose(): Promise<void> {
    const promises = [];
    if (this._groupsCachedValue) {
      promises.push(disposeChain<any>(this._groupsCachedValue));
    }
    if (this._roomsCachedValue) {
      promises.push(disposeChain(this._roomsCachedValue));
    }
    for (const cachedValue of this._eventsCachedValues.values()) {
      promises.push(disposeChain(cachedValue));
    }
    if (promises.length > 0) {
      await Promise.all(promises);
    }
  }

  async getEventsResponse(
    type: TimetableType,
    entityId: number | string,
    dateLimits?: DeepReadonly<IDateLimits>
  ): Promise<ApiEventsResponse> {
    const params = { entityId, dateLimits, typeId: type };
    const hash = getEventsCacheFileNamePart(params);
    let cachedValue = this._eventsCachedValues.get(hash);
    if (!cachedValue) {
      cachedValue = await this.createEventsCachedValue(params);
      this._eventsCachedValues.set(hash, cachedValue);
    }
    const response = await cachedValue.loadValue();
    if (!response) {
      throw new TypeError(e('failed to find value in cache chain!'));
    }
    return response;
  }

  async getGroupsResponse(): Promise<ApiGroupsResponse> {
    if (!this._groupsCachedValue) {
      this._groupsCachedValue = await this.createGroupsCachedValue();
    }
    const response = await this._groupsCachedValue.loadValue();
    if (!response) {
      throw new TypeError(g('failed to find value in cache chain!'));
    }
    return response;
  }

  async getRoomsResponse(): Promise<ApiAuditoriesResponse> {
    if (!this._roomsCachedValue) {
      this._roomsCachedValue = await this.createRoomsCachedValue();
    }
    const response = await this._roomsCachedValue.loadValue();
    if (!response) {
      throw new TypeError(r('failed to find value in cache chain!'));
    }
    return response;
  }

  async clearEventsCache(): Promise<void> {
    for (const cachedValue of this._eventsCachedValues.values()) {
      await cachedValue.dispose();
    }
    this._eventsCachedValues.clear();
    const errors = [];
    if (this._cacheConfig.priorities.events.includes(CacheType.Http)) {
      const fileNames = await fs.readdir(this._baseDirectory);
      for (const fileName of fileNames) {
        if (!isEventsCacheFile(fileName)) {
          continue;
        }
        try {
          const cachedValue = new FileCachedValue(
            this._cacheUtils,
            path.join(this._baseDirectory, fileName),
          );
          if (cachedValue.isDestroyable) {
            if (!cachedValue.isInitialized) {
              await cachedValue.init();
            }
            await cachedValue.destroy();
          } else {
            await cachedValue.dispose();
          }
        } catch (error) {
          errors.push(new NestedError(`Failed to destroy cache at ${fileName}`, error));
        }
      }
    }
    if (errors.length > 0) {
      throw new MultiError('Multiple exceptions happened', errors);
    }
  }

  async clearGroupsCache(): Promise<void> {
    if (!this._groupsCachedValue) {
      this._groupsCachedValue = await this.createGroupsCachedValue();
    }
    await destroyChain(this._groupsCachedValue);
    this._groupsCachedValue = null;
  }

  async clearRoomsCache(): Promise<void> {
    if (!this._roomsCachedValue) {
      this._roomsCachedValue = await this.createRoomsCachedValue();
    }
    await destroyChain(this._roomsCachedValue);
    this._roomsCachedValue = null;
  }

  private async createGroupsCachedValue() {
    let cachedValue: Nullable<CachedValue<ApiGroupsResponse>> = null;
    for (
      let i = this._cacheConfig.priorities.groups.length - 1,
        type = this._cacheConfig.priorities.groups[i];
      i >= 0;
      i -= 1, type = this._cacheConfig.priorities.groups[i]
    ) {
      const oldCachedValue = cachedValue;
      switch (type) {
        case CacheType.Http:
          if (!this._http) {
            throw new TypeError(g('An initialized CIST HTTP client is required'));
          }
          cachedValue = new CistJsonHttpGroupsCachedValue(
            this._cacheUtils,
            this._http
          );
          if (!cachedValue.needsSource) {
            throw new TypeError(g('HTTP requests must be last in the cache chain'));
          }
          if (!cachedValue.isInitialized) {
            await cachedValue.init();
          }
          break;

        case CacheType.File:
          cachedValue = new FileCachedValue<ApiGroupsResponse>(
            this._cacheUtils,
            path.join(
              this._baseDirectory,
              getCacheFileName(RequestType.Groups),
            ),
          );
          if (!cachedValue.isInitialized) {
            await cachedValue.init();
          }
          await cachedValue.setSource(oldCachedValue);
          break;

        default:
          throw new TypeError(g(`Unknown type of cache: ${type}`));
      }
    }
    if (!cachedValue) {
      throw new TypeError(g('No cache sources found'));
    }
    return cachedValue;
  }

  private async createRoomsCachedValue() {
    let cachedValue: Nullable<CachedValue<ApiAuditoriesResponse>> = null;
    for (
      let i = this._cacheConfig.priorities.groups.length - 1,
        type = this._cacheConfig.priorities.groups[i];
      i >= 0;
      i -= 1, type = this._cacheConfig.priorities.groups[i]
    ) {
      const oldCachedValue = cachedValue;
      switch (type) {
        case CacheType.Http:
          if (!this._http) {
            throw new TypeError(r('An initialized CIST HTTP client is required'));
          }
          cachedValue = new CistJsonHttpRoomsCachedValue(
            this._cacheUtils,
            this._http
          );
          if (!cachedValue.needsSource) {
            throw new TypeError(r('HTTP requests must be last in the cache chain'));
          }
          if (!cachedValue.isInitialized) {
            await cachedValue.init();
          }
          break;

        case CacheType.File:
          cachedValue = new FileCachedValue<ApiAuditoriesResponse>(
            this._cacheUtils,
            path.join(this._baseDirectory, getCacheFileName(RequestType.Rooms)),
          );
          if (!cachedValue.isInitialized) {
            await cachedValue.init();
          }
          await cachedValue.setSource(oldCachedValue);
          break;

        default:
          throw new TypeError(r(`Unknown type of cache: ${type}`));
      }
    }
    if (!cachedValue) {
      throw new TypeError(r('No cache sources found'));
    }
    return cachedValue;
  }

  private async createEventsCachedValue(
    params: DeepReadonly<IEventsQueryParams>
  ) {
    let cachedValue: Nullable<CachedValue<ApiEventsResponse>> = null;
    for (
      let i = this._cacheConfig.priorities.groups.length - 1,
        type = this._cacheConfig.priorities.groups[i];
      i >= 0;
      i -= 1, type = this._cacheConfig.priorities.groups[i]
    ) {
      const oldCachedValue = cachedValue;
      switch (type) {
        case CacheType.Http:
          if (!this._http) {
            throw new TypeError(e('An initialized CIST HTTP client is required'));
          }
          cachedValue = new CistJsonHttpEventsCachedValue(
            this._cacheUtils,
            this._http,
            params,
          );
          if (!cachedValue.needsSource) {
            throw new TypeError(e('HTTP requests must be last in the cache chain'));
          }
          if (!cachedValue.isInitialized) {
            await cachedValue.init();
          }
          break;

        case CacheType.File:
          cachedValue = new FileCachedValue<ApiEventsResponse>(
            this._cacheUtils,
            path.join(
              this._baseDirectory,
              getCacheFileName(RequestType.Events, params),
            ),
          );
          if (!cachedValue.isInitialized) {
            await cachedValue.init();
          }
          await cachedValue.setSource(oldCachedValue);
          break;

        default:
          throw new TypeError(e(`Unknown type of cache: ${type}`));
      }
    }
    if (!cachedValue) {
      throw new TypeError(e('No cache sources found'));
    }
    return cachedValue;
  }

  private includesCache(type: CacheType) {
    return includesCache(this._cacheConfig, type);
  }
}

const separator = '.';
function getCacheFileName(
  type: RequestType.Events,
  options: DeepReadonly<IEventsQueryParams>
): string;
function getCacheFileName(type: RequestType.Groups | RequestType.Rooms): string;
function getCacheFileName(
  type: RequestType,
  options?: DeepReadonly<IEventsQueryParams>,
) {
  let hash = type.toString();
  if (options) {
    hash += getEventsCacheFileNamePart(options);
  }
  return `${hash}.tmp`;
}

function getEventsCacheFileNamePart(options: DeepReadonly<IEventsQueryParams>) {
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
  return hash;
}

const fileNameRegex = new RegExp(`^${RequestType.Events}\.[1-3]\.\\d+(\.\\d*\.\\d*)?\.tmp`);
function isEventsCacheFile(fileName: string) {
  return fileNameRegex.test(fileName);
}

function r(text: string) {
  return `CIST Auditories: ${text}`;
}

function e(text: string) {
  return `CIST Events: ${text}`;
}

function g(text: string) {
  return `CIST Groups: ${text}`;
}
