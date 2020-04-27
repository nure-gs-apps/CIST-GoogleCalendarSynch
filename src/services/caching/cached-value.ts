import { Sema } from 'async-sema/lib';
import { EventEmitter } from 'events';
import { ReadonlyDate } from 'readonly-date';
import { asReadonly, IDisposable, Nullable } from '../../@types';
import { NestedError } from '../../errors';
import { throwAsyncIfAny } from '../../utils/common';
import { CacheUtilsService } from '../cache-utils.service';

export enum CacheEvent {
  CacheUpdated = 'cache-updated',
  CacheCleared = 'cache-cleared',
  SourceChanged = 'source-changed',
}

export interface IReadonlyCachedValue<T> extends ICacheEventEmitter<T>, IDisposable {
  readonly isInitialized: boolean;
  readonly isDestroyable: boolean;
  readonly needsInit: boolean;
  readonly expiration: ReadonlyDate;
  readonly backgroundTask: Nullable<Promise<any>>;
  init(): Promise<boolean>;
  loadValue(): Promise<Nullable<T>>;
  loadFromCache(): Promise<Nullable<T>>;
}

export interface ICacheEventEmitter<T> {
  on(event: CacheEvent.CacheUpdated, listener: CacheUpdatedListener<T>): this;
  on(event: CacheEvent.CacheCleared, listener: CacheClearedListener): this;
  on(
    event: CacheEvent.SourceChanged, listener: SourceChangedListener<T>
  ): this;

  /**
   * Called when async operation fails in event listener for the source's events.
   */
  on(event: 'error', listener: CacheErrorListener<T>): this;
}

export type CacheClearedListener = () => void;
export type CacheUpdatedListener<T> = (
  value: T, expiration: ReadonlyDate, requester?: unknown
) => void;
export type SourceChangedListener<T> = (
  newCache: Nullable<CachedValue<T>>, oldCache: Nullable<CachedValue<T>>
) => void;
export type CacheErrorListener<T> = (error: CachedValueError<T>) => void;

export type ErrorSourceEvent = CacheEvent | 'error';
export class CachedValueError<T> extends Error {
  readonly error: any;
  readonly source: CachedValue<T>;
  readonly sourceEvent: ErrorSourceEvent;
  readonly initialEvent?: CacheEvent;

  constructor(
    error: any,
    source: CachedValue<T>,
    sourceEvent: ErrorSourceEvent,
    initialEvent?: CacheEvent
  ) {
    super(error.message);
    this.error = error;
    this.source = source;
    this.sourceEvent = sourceEvent;
    if (initialEvent) {
      this.initialEvent = initialEvent;
    }
  }
}

export abstract class CachedValue<T> extends EventEmitter implements IReadonlyCachedValue<T>, ICacheEventEmitter<T>, IDisposable {
  readonly [asReadonly]: IReadonlyCachedValue<T>;
  abstract readonly needsSource: boolean;
  abstract readonly isDestroyable: boolean;
  abstract readonly needsInit: boolean;

  protected readonly _utils: CacheUtilsService;

  protected readonly _saveValueErrorHandler: (error: any) => never;
  protected readonly _doLoadFromCacheErrorHandler: (error: any) => never;

  private _source: Nullable<CachedValue<T>>;
  private _expiration: ReadonlyDate;
  private _isInitialized: boolean;

  private _clearTimeout: Nullable<NodeJS.Timeout>;
  private readonly clearListener: CacheClearedListener;
  private readonly updateListener: CacheUpdatedListener<T>;
  private readonly errorListener: CacheErrorListener<T>;
  private readonly _initSema: Sema;
  private _backgroundTask: Nullable<Promise<any>>;

  get source(): Nullable<CachedValue<T>> {
    if (!this.needsSource) {
      throw new TypeError(this.t('doesn\'t support sources!'));
    }
    return this._source;
  }

  get expiration() {
    return this._expiration;
  }

  get isInitialized() {
    return !this.needsInit || this._isInitialized;
  }

  get isDisposed() {
    return !this.isInitialized;
  }

  get backgroundTask() {
    return this._backgroundTask;
  }

  get [Symbol.toStringTag]() {
    return CachedValue.name;
  }

  protected constructor(utils: CacheUtilsService) {
    super();
    this[asReadonly] = this;
    this._utils = utils;
    this._source = null;
    this._expiration = this._utils.getMaxExpiration();
    this._isInitialized = false;
    this._initSema = new Sema(1);
    this._backgroundTask = null;

    this._clearTimeout = null;
    this.clearListener = () => throwAsyncIfAny(
      () => this.queueBackgroundTask(this.clearCache()),
      error => this.emit(
        'error',
        new CachedValueError(error, this, CacheEvent.CacheCleared),
      )
    ).catch(error => this.emit('error', error));
    this.updateListener = (value, expiration, requester) => {
      if (requester !== this) {
        throwAsyncIfAny(
          () => this.queueBackgroundTask(this.saveValue(value, expiration)
            .catch(this._saveValueErrorHandler)
            .then(() => {
              return this.doSetExpiration(expiration, value !== null);
            }).then(() => {
              this.emit(CacheEvent.CacheUpdated, value, this._expiration);
            })),
          error => this.emit(
            'error',
            new CachedValueError(error, this, CacheEvent.CacheUpdated),
          )
        ).catch(error => this.emit('error', error));
      }
    };
    this.errorListener = error => {
      if (error instanceof CachedValueError) {
        this.emit('error', error.sourceEvent === 'error'
          ? error
          : new CachedValueError(
            error.error,
            error.source,
            'error',
            error.sourceEvent
        ));
      } else {
        this.emit('error', error);
      }
    };
    this._saveValueErrorHandler = error => {
      throw new NestedError(this.t('failed to save value'), error);
    };
    this._doLoadFromCacheErrorHandler = error => {
      throw new NestedError(this.t('failed to load from cache'), error);
    };
  }

  canUseExpiration(possibleExpiration: ReadonlyDate) {
    return !this.needsSource || !this._source || (
      this._source.expiration.valueOf() >= possibleExpiration.valueOf()
    );
  }

  async setExpiration(date: ReadonlyDate) {
    this._utils.assertValidExpiration(date);
    if (!this.canUseExpiration(date)) {
      throw new TypeError(this.t(`Cannot set expiration longer than parent ${this._source?.[Symbol.toStringTag]} has`));
    }
    if (this._expiration.valueOf() < Date.now()) {
      await this.clearCache();
    }
    await this.doSetExpiration(date);
  }

  async init(): Promise<boolean> {
    await this._initSema.acquire();
    try {
      const shouldInit = this.needsInit && !this.isInitialized;
      if (shouldInit) {
        await this.doInit().catch(error => {
          throw new NestedError(this.t('failed to initialize'), error);
        });
        await this.doSetExpiration(this._utils.clampExpiration(
          await this.loadExpirationFromCache().catch(error => {
            throw new NestedError(
              this.t('failed load expiration from cache'),
              error
            );
          })
        ));
        this._isInitialized = true;
      }
      return shouldInit;
    } finally {
      await this._initSema.release();
    }
  }

  async setSource(
    source: Nullable<CachedValue<T>> = null,
    clearCache = false,
    loadValue = false,
  ) {
    if (!this.needsSource) {
      throw new TypeError(this.t('does not require source'));
    }
    const changed = source !== this._source;
    if (!changed) {
      return false;
    }
    if (this._source) {
      this._source.off(CacheEvent.CacheUpdated, this.updateListener);
      this._source.off(CacheEvent.CacheCleared, this.clearListener);
      this._source.off('error', this.errorListener);
      if (clearCache) {
        await this.clearCache();
      }
    }
    const oldSource = this._source;
    this._source = source;
    if (this._source) {
      this._source.on(CacheEvent.CacheUpdated, this.updateListener);
      this._source.on(CacheEvent.CacheCleared, this.clearListener);
      this._source.on('error', this.errorListener);
      if (loadValue) {
        const value = await this._source.loadValueWithRequester(this);
        const shouldSetExpiration = (
          this._expiration.valueOf() < this._source.expiration.valueOf()
        );
        const newExpiration = shouldSetExpiration
          ? this._source.expiration
          : this._expiration;
        if (value !== null) {
          await this.saveValue(value, newExpiration)
            .catch(this._saveValueErrorHandler);
          this.emit(CacheEvent.CacheUpdated, value, newExpiration);
        }
        if (shouldSetExpiration) {
          await this.doSetExpiration(
            this._source.expiration,
            value !== null
          );
        }
      }
    }
    this.emit(CacheEvent.SourceChanged, this._source, oldSource);
    return true;
  }

  async clearCache(): Promise<boolean> {
    if (!await this.doClearCache().catch(error => {
      throw new NestedError(this.t('failed to clear cache'), error);
    })) {
      return false;
    }
    this.emit(CacheEvent.CacheCleared);
    this._expiration = this._source?.expiration
      ?? this._utils.getMaxExpiration();
    if (this._clearTimeout) {
      clearTimeout(this._clearTimeout);
    }
    return true;
  }

  public loadValue() {
    return this.loadValueWithRequester(this);
  }

  protected async loadValueWithRequester(requester: any) {
    this.assertInitialized();
    const tuple = await this.doLoadValue(requester).catch(error => {
      throw new NestedError(this.t('failed to load value'), error);
    });
    tuple[1] = this._utils.clampExpiration(
      tuple[1],
      this._source?.expiration ?? this._utils.getMaxExpiration()
    );
    const [newValue, expiration] = tuple;
    if (expiration.valueOf() < this._expiration.valueOf()) {
      await this.doSetExpiration(expiration, newValue !== null);
      if (this._expiration.valueOf() > Date.now()) {
        this.emit(
          CacheEvent.CacheUpdated,
          newValue,
          this._expiration,
          requester,
        );
      }
    } else {
      this.emit(CacheEvent.CacheUpdated, newValue, this._expiration, requester);
    }
    return newValue;
  }

  async loadFromCache(): Promise<Nullable<T>> {
    this.assertInitialized();
    const tuple = await this.doLoadFromCache()
      .catch(this._doLoadFromCacheErrorHandler);
    tuple[1] = this._utils.clampExpiration(
      tuple[1],
    this._source?.expiration ?? this._utils.getMaxExpiration()
    );
    const [value, expiration] = tuple;
    await this.doSetExpiration(expiration, value !== null);
    return value;
  }

  async dispose() {
    await this._initSema.acquire();
    try {
      if (this.isDisposed) {
        return;
      }
      await this._backgroundTask;
      await this.doDispose();
      this._isInitialized = false;
    } finally {
      await this._initSema.release();
    }
  }

  async destroy() {
    if (!this.isDestroyable) {
      return false;
    }
    this.assertInitialized();
    await this.dispose();
    await this.doDestroy();
    return true;
  }

  // virtual
  protected doInit(): Promise<void> {
    return Promise.resolve();
  }

  // virtual - intercept entire load sequence
  protected async doLoadValue(
    requester?: any
  ): Promise<[Nullable<T>, ReadonlyDate]> {
    const cachedTuple = await this.doLoadFromCache()
      .catch(this._doLoadFromCacheErrorHandler);
    if (cachedTuple[0] !== null && cachedTuple[1].valueOf() >= Date.now()) {
      return cachedTuple;
    }
    return this.loadValueFromSource();
  }

  protected abstract doLoadFromCache(): Promise<[Nullable<T>, ReadonlyDate]>;

  // virtual
  protected updateExpiration(date: ReadonlyDate): Promise<void> {
    return Promise.resolve();
  }

  protected abstract loadExpirationFromCache(): Promise<ReadonlyDate>;

  protected async loadValueFromSource(): Promise<[Nullable<T>, ReadonlyDate]> {
    const source = this._source;
    if (!source) {
      throw new TypeError(this.t('source is not set'));
    }
    const value = await source.loadValueWithRequester(this);
    await this.saveValue(value, source.expiration)
      .catch(this._saveValueErrorHandler);
    return [value, source.expiration];
  }

  protected doDispose() {
    return Promise.resolve();
  }

  protected doDestroy() {
    return Promise.resolve();
  }

  // virtual
  protected saveValue(
    value: Nullable<T>, expiration: ReadonlyDate
  ): Promise<void> {
    return Promise.resolve();
  }

  protected abstract hasCachedValue(): Promise<boolean>;

  protected abstract doClearCache(): Promise<boolean>;

  private async doSetExpiration(
    newDate: ReadonlyDate,
    hasValue?: boolean
  ) {
    if (hasValue === undefined) {
      // tslint:disable-next-line:no-parameter-reassignment
      hasValue = await this.hasCachedValue().catch(error => {
        throw new NestedError(this.t('failed check if has cached value'), error);
      });
    }
    if (newDate.valueOf() === this._expiration.valueOf()) {
      return;
    }
    this._expiration = newDate;
    if (this._clearTimeout) {
      clearTimeout(this._clearTimeout);
    }
    const now = Date.now();
    if (newDate.valueOf() > now) {
      if (hasValue) {
        this._clearTimeout = setTimeout(() => throwAsyncIfAny(
          () => this.clearCache(),
          error => new CachedValueError(
            error, this, CacheEvent.CacheCleared
          )
        ).catch(error => this.emit('error', error)), now - newDate.valueOf());
      }
    }
    await this.updateExpiration(this._expiration).catch(error => {
      throw new NestedError(this.t('failed to set new expiration'), error);
    });
  }

  private assertInitialized() {
    if (!this.isInitialized) {
      throw new TypeError(this.t('is not initialized'));
    }
  }

  protected t(message: string) {
    return `${this[Symbol.toStringTag]}: ${message}`;
  }

  private queueBackgroundTask(task: Promise<any>) {
    const newTask = Promise.resolve( // To ensure that Bluebird is used
      this._backgroundTask
      ? this._backgroundTask.finally(() => task)
      : task
    ).finally(() => {
      if (newTask === this._backgroundTask) {
        this._backgroundTask = null;
      }
    });
    this._backgroundTask = newTask;
    return task;
  }
}
