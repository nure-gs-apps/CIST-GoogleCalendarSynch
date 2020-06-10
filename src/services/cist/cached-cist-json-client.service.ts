import { Sema } from 'async-sema/lib';
import { promises as fs } from 'fs';
import { inject, injectable, interfaces, optional } from 'inversify';
import * as path from 'path';
import { ReadonlyDate } from 'readonly-date';
import { DeepReadonly, Nullable, Optional } from '../../@types';
import {
  ASYNC_INIT,
  IAsyncInitializable,
  IDisposable,
  Disposer,
} from '../../@types/object';
import { CacheType, CistCacheConfig } from '../../config/types';
import { TYPES } from '../../di/types';
import { MultiError, NestedError } from '../../errors';
import {
  destroyChain,
  disposeChain,
  setExpirationInChain,
} from '../../utils/caching';
import { includesCache } from '../../utils/cist';
import {
  dateToSeconds,
  PathUtils,
} from '../../utils/common';
import { CacheUtilsService } from '../caching/cache-utils.service';
import { CachedValue } from '../caching/cached-value';
import { FileCachedValue } from '../caching/file-cached-value';
import { CistJsonHttpClient } from './cist-json-http-client.service';
import { CistJsonHttpEventsCachedValue } from './cist-json-http-events-cached-value';
import { CistJsonHttpGroupsCachedValue } from './cist-json-http-groups-cached-value';
import { CistJsonHttpRoomsCachedValue } from './cist-json-http-rooms-cached-value';
import {
  CistRoomsResponse,
  CistEventsResponse,
  CistGroupsResponse,
  ICistJsonClient,
  IDateLimits,
  IEventsQueryParams,
  TimetableType, EntityType,
} from '../../@types/cist';

export function getSharedCachedCistJsonClientInstance(
  context: interfaces.Context
) {
  return context.container.get<CachedCistJsonClientService>(
    CachedCistJsonClientService
  );
}

@injectable()
export class CachedCistJsonClientService extends Disposer implements ICistJsonClient, IAsyncInitializable, IDisposable {
  readonly [ASYNC_INIT]: Promise<any>;

  private readonly _cacheConfig: DeepReadonly<CistCacheConfig>;
  private readonly _cacheUtils: CacheUtilsService;
  private readonly _baseDirectory: string;
  private readonly _http: Nullable<CistJsonHttpClient>;
  // tslint:disable-next-line:max-line-length
  private readonly _eventsCachedValues: Map<string, CachedValue<CistEventsResponse>>;
  private readonly _eventsCacheSemaphores: Map<string, Sema>;
  // tslint:disable-next-line:max-line-length
  private _groupsCachedValue: Nullable<CachedValue<CistGroupsResponse>>;
  private _groupsCacheSemaphore: Nullable<Sema>;
  // tslint:disable-next-line:max-line-length
  private _roomsCachedValue: Nullable<CachedValue<CistRoomsResponse>>;
  private _roomsCacheSemaphore: Nullable<Sema>;

  constructor(
    @inject(TYPES.CacheUtils) cacheUtils: CacheUtilsService,
    @inject(TYPES.CistCacheConfig) cacheConfig: DeepReadonly<CistCacheConfig>,
    // tslint:disable-next-line:max-line-length
    @inject(TYPES.CistJsonHttpClient) @optional() http: Optional<CistJsonHttpClient>
  ) {
    super(); // a doDispose() method override is used
    this._cacheConfig = cacheConfig;
    this._cacheUtils = cacheUtils;
    this._eventsCachedValues = new Map();
    this._eventsCacheSemaphores = new Map();
    this._groupsCachedValue = null;
    this._groupsCacheSemaphore = null;
    this._roomsCachedValue = null;
    this._roomsCacheSemaphore = null;

    this[ASYNC_INIT] = Promise.resolve();

    // File cache
    if (this.includesCache(CacheType.File)) {
      this._baseDirectory = path.resolve(PathUtils.expandVars(
        PathUtils.getPath(this._cacheConfig.configs[CacheType.File].directory)
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

  protected async doDispose(): Promise<void> {
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
  ): Promise<CistEventsResponse> {
    const cachedValue = await this.getEventsCachedValue(
      type,
      entityId,
      dateLimits,
    );
    const response = await cachedValue.loadValue();
    if (!response) {
      throw new TypeError(e('failed to find value in cache chain!'));
    }
    return response;
  }

  async getGroupsResponse(): Promise<CistGroupsResponse> {
    const response = await (await this.getGroupsCachedValue()).loadValue();
    if (!response) {
      throw new TypeError(g('failed to find value in cache chain!'));
    }
    return response;
  }

  async getRoomsResponse(): Promise<CistRoomsResponse> {
    const response = await (await this.getRoomsCachedValue()).loadValue();
    if (!response) {
      throw new TypeError(r('failed to find value in cache chain!'));
    }
    return response;
  }

  async setEventsCacheExpiration(
    expiration: ReadonlyDate,
    type: TimetableType,
    entityId: number | string,
    dateLimits?: DeepReadonly<IDateLimits>,
  ) {
    const cachedValue = await this.getEventsCachedValue(
      type,
      entityId,
      dateLimits,
    );
    await setExpirationInChain(cachedValue, expiration);
  }

  async setGroupsCacheExpiration(expiration: ReadonlyDate) {
    await setExpirationInChain(await this.getGroupsCachedValue(), expiration);
  }

  async setRoomsCacheExpiration(expiration: ReadonlyDate) {
    await setExpirationInChain(await this.getRoomsCachedValue(), expiration);
  }

  async destroyEventsCache(): Promise<void> {
    for (const cachedValue of this._eventsCachedValues.values()) {
      await cachedValue.dispose();
    }
    this._eventsCachedValues.clear();
    const errors = [];
    if (this._cacheConfig.priorities.events.includes(CacheType.File)) {
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

  async destroyGroupsCache(): Promise<void> {
    await destroyChain(await this.getGroupsCachedValue());
    this._groupsCachedValue = null;
  }

  async destroyRoomsCache(): Promise<void> {
    await destroyChain(await this.getRoomsCachedValue());
    this._roomsCachedValue = null;
  }

  private async getGroupsCachedValue() {
    if (!this._groupsCachedValue) {
      if (!this._groupsCacheSemaphore) {
        this._groupsCacheSemaphore = new Sema(1);
      }
      await this._groupsCacheSemaphore.acquire();
      if (!this._groupsCachedValue) {
        this._groupsCachedValue = await this.createGroupsCachedValue();
      }
      this._groupsCacheSemaphore.release();
    }
    return this._groupsCachedValue;
  }

  private async createGroupsCachedValue() {
    let cachedValue: Nullable<CachedValue<CistGroupsResponse>> = null;
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
          if (!cachedValue.needsSource && oldCachedValue) {
            throw new TypeError(g('HTTP requests must be last in the cache chain'));
          }
          if (!cachedValue.isInitialized) {
            await cachedValue.init();
          }
          break;

        case CacheType.File:
          cachedValue = new FileCachedValue<CistGroupsResponse>(
            this._cacheUtils,
            path.join(
              this._baseDirectory,
              getCacheFileName(EntityType.Groups),
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

  private async getRoomsCachedValue() {
    if (!this._roomsCachedValue) {
      if (!this._roomsCacheSemaphore) {
        this._roomsCacheSemaphore = new Sema(1);
      }
      await this._roomsCacheSemaphore.acquire();
      if (!this._roomsCachedValue) {
        this._roomsCachedValue = await this.createRoomsCachedValue();
      }
      this._roomsCacheSemaphore.release();
    }
    return this._roomsCachedValue;
  }

  private async createRoomsCachedValue() {
    let cachedValue: Nullable<CachedValue<CistRoomsResponse>> = null;
    for (
      let i = this._cacheConfig.priorities.auditories.length - 1,
        type = this._cacheConfig.priorities.auditories[i];
      i >= 0;
      i -= 1, type = this._cacheConfig.priorities.auditories[i]
    ) {
      const oldCachedValue = cachedValue;
      switch (type) {
        case CacheType.Http:
          // cachedValue = new FileCachedValue<CistRoomsResponse>(
          //   this._cacheUtils,
          //   '/var/tmp/ncgc/cache/cist/rooms.tmp.tmp',
          // );
          // if (!cachedValue.isInitialized) {
          //   await cachedValue.init();
          // }
          // await cachedValue.setSource(oldCachedValue);
          if (!this._http) {
            throw new TypeError(r('An initialized CIST HTTP client is required'));
          }
          cachedValue = new CistJsonHttpRoomsCachedValue(
            this._cacheUtils,
            this._http
          );
          if (!cachedValue.needsSource && oldCachedValue) {
            throw new TypeError(r('HTTP requests must be last in the cache chain'));
          }
          if (!cachedValue.isInitialized) {
            await cachedValue.init();
          }
          break;

        case CacheType.File:
          cachedValue = new FileCachedValue<CistRoomsResponse>(
            this._cacheUtils,
            path.join(this._baseDirectory, getCacheFileName(EntityType.Rooms)),
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

  private async getEventsCachedValue(
    type: TimetableType,
    entityId: number | string,
    dateLimits?: DeepReadonly<IDateLimits>
  ) {
    const params = { entityId, dateLimits, typeId: type };
    const hash = getEventHash(params);
    let cachedValue = this._eventsCachedValues.get(hash);
    if (!cachedValue) {
      let semaphore = this._eventsCacheSemaphores.get(hash);
      if (!semaphore) {
        semaphore = new Sema(1);
        this._eventsCacheSemaphores.set(hash, semaphore);
      }
      await semaphore.acquire();
      if (!cachedValue) {
        cachedValue = await this.createEventsCachedValue(params);
        this._eventsCachedValues.set(hash, cachedValue);
      }
      semaphore.release();
    }
    return cachedValue;
  }

  private async createEventsCachedValue(
    params: DeepReadonly<IEventsQueryParams>
  ) {
    let cachedValue: Nullable<CachedValue<CistEventsResponse>> = null;
    for (
      let i = this._cacheConfig.priorities.events.length - 1,
        type = this._cacheConfig.priorities.events[i];
      i >= 0;
      i -= 1, type = this._cacheConfig.priorities.events[i]
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
          if (!cachedValue.needsSource && oldCachedValue) {
            throw new TypeError(e('HTTP requests must be last in the cache chain'));
          }
          if (!cachedValue.isInitialized) {
            await cachedValue.init();
          }
          break;

        case CacheType.File:
          cachedValue = new FileCachedValue<CistEventsResponse>(
            this._cacheUtils,
            path.join(
              this._baseDirectory,
              getCacheFileName(EntityType.Events, params),
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
  type: EntityType.Events,
  options: DeepReadonly<IEventsQueryParams>
): string;
function getCacheFileName(type: EntityType.Groups | EntityType.Rooms): string;
function getCacheFileName(
  type: EntityType,
  options?: DeepReadonly<IEventsQueryParams>,
) {
  let hash = type.toString();
  if (options) {
    hash += separator + getEventHash(options);
  }
  return `${hash}.tmp`;
}

function getEventHash(options: DeepReadonly<IEventsQueryParams>) {
  let hash = options.typeId.toString() + separator + options.entityId;
  if (options.dateLimits && (
    options.dateLimits.from || options.dateLimits.to
  )) {
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

const fileNameRegex = new RegExp(`^${EntityType.Events}\\.[1-3]\\.\\d+(\\.(\\d*\\.\\d+|\\d+\\.))?\\.tmp$`);
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
