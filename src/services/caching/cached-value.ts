import { EventEmitter } from 'events';
import { ReadonlyDate } from 'readonly-date';
import { asReadonly, IDisposable, Nullable } from '../../@types';
import { throwAsyncIfAny } from '../../utils/common';
import { CacheUtilsService } from '../cache-utils.service';

export enum CacheEvent {
  CacheUpdated = 'cache-updated',
  CacheCleared = 'cache-cleared',
  SourceChanged = 'source-changed',
}

export interface IReadonlyCachedValue<T> extends ICacheEventEmitter<T>, IDisposable {
  readonly isInitialized: boolean;
  readonly expiration: ReadonlyDate;
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
  value: T, expiration: ReadonlyDate
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
  protected abstract readonly needsInit: boolean;
  protected readonly _utils: CacheUtilsService;

  private _source: Nullable<CachedValue<T>>;
  private _expiration: ReadonlyDate;
  private _isInitialized: boolean;

  private _clearTimeout: Nullable<NodeJS.Timeout>;
  private readonly clearListener: CacheClearedListener;
  private readonly updateListener: CacheUpdatedListener<T>;
  private readonly errorListener: CacheErrorListener<T>;

  get source(): Nullable<CachedValue<T>> {
    if (!this.needsSource) {
      throw new TypeError(`${this.constructor.name} doesn\'t support sources!`);
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

  protected constructor(utils: CacheUtilsService) {
    super();
    this[asReadonly] = this;
    this._utils = utils;
    this._source = null;
    this._expiration = this._utils.getMaxExpiration();
    this._isInitialized = false;

    this._clearTimeout = null;
    this.clearListener = () => throwAsyncIfAny(
      () => this.clearCache(),
      error => this.emit(
        'error',
        new CachedValueError(error, this, CacheEvent.CacheCleared),
      )
    ).catch(error => this.emit('error', error));
    this.updateListener = (value, expiration) => throwAsyncIfAny(
      () => this.saveValue(value, expiration).then(() => {
        return this.doSetExpiration(expiration, value !== null);
      }).then(() => {
        this.emit(CacheEvent.CacheUpdated, value, this._expiration);
      }),
      error => this.emit(
        'error',
        new CachedValueError(error, this, CacheEvent.CacheUpdated),
      )
    ).catch(error => this.emit('error', error));
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
  }

  canUseExpiration(possibleExpiration: ReadonlyDate) {
    return !this.needsSource || !this._source || (
      this._source.expiration.valueOf() >= possibleExpiration.valueOf()
    );
  }

  async setExpiration(date: ReadonlyDate) {
    this._utils.assertValidExpiration(date);
    if (!this.canUseExpiration(date)) {
      throw new TypeError('Cannot set expiration longer than parent has');
    }
    if (this._expiration.valueOf() < Date.now()) {
      await this.clearCache();
    }
    await this.doSetExpiration(date);
  }

  async init(): Promise<boolean> {
    const shouldInit = this.needsInit && !this.isInitialized;
    if (shouldInit) {
      await this.doInit();
      this._expiration = this._utils.clampExpiration(
        await this.loadExpirationFromCache()
      );
      this._isInitialized = true;
    }
    return shouldInit;
  }

  async setSource(source: Nullable<CachedValue<T>> = null) {
    if (!this.needsSource) {
      throw new TypeError(`This ${this.constructor.name} does not require source`);
    }
    const changed = source !== this._source;
    if (!changed) {
      return false;
    }
    if (this._source) {
      this._source.off(CacheEvent.CacheUpdated, this.updateListener);
      this._source.off(CacheEvent.CacheCleared, this.clearListener);
      this._source.off('error', this.errorListener);
      await this.clearCache();
    }
    const oldSource = this._source;
    this._source = source;
    if (this._source) {
      this._source.on(CacheEvent.CacheUpdated, this.updateListener);
      this._source.on(CacheEvent.CacheCleared, this.clearListener);
      this._source.on('error', this.errorListener);
      const value = await this._source.loadValue();
      const shouldSetExpiration = (
        this._expiration.valueOf() < this._source.expiration.valueOf()
      );
      const newExpiration = shouldSetExpiration
        ? this._source.expiration
        : this._expiration;
      if (value !== null) {
        await this.saveValue(value, newExpiration);
        this.emit(CacheEvent.CacheUpdated, value, newExpiration);
      }
      if (shouldSetExpiration) {
        await this.doSetExpiration(
          this._source.expiration,
          value !== null
        );
      }
    }
    this.emit(CacheEvent.SourceChanged, this._source, oldSource);
    return true;
  }

  async clearCache(): Promise<boolean> {
    if (!await this.doClearCache()) {
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

  async loadValue() {
    if (!this.isInitialized) {
      throw new TypeError('CachedValue is not initialized');
    }
    const tuple = await this.doLoadValue();
    tuple[1] = this._utils.clampExpiration(
      tuple[1],
      this._source?.expiration ?? this._utils.getMaxExpiration()
    );
    const [newValue, expiration] = tuple;
    if (expiration.valueOf() < this._expiration.valueOf()) {
      await this.doSetExpiration(expiration, newValue !== null);
      if (this._expiration.valueOf() > Date.now()) {
        this.emit(CacheEvent.CacheUpdated, newValue, this._expiration);
      }
    } else {
      this.emit(CacheEvent.CacheUpdated, newValue, this._expiration);
    }
    return newValue;
  }

  async loadFromCache(): Promise<Nullable<T>> {
    if (!this.needsSource) {
      throw new TypeError(`This ${this.constructor.name} does not require source`);
    }
    const tuple = await this.doLoadFromCache();
    tuple[1] = this._utils.clampExpiration(
      tuple[1],
    this._source?.expiration ?? this._utils.getMaxExpiration()
    );
    const [value, expiration] = tuple;
    await this.doSetExpiration(expiration, value !== null);
    return value;
  }

  async dispose() {
    if (this.isDisposed) {
      return;
    }
    await this.doDispose();
    this._isInitialized = false;
  }

  // virtual
  protected doInit(): Promise<void> {
    return Promise.resolve();
  }

  // virtual - intercept entire load sequence
  protected async doLoadValue(): Promise<[Nullable<T>, ReadonlyDate]> {
    const cachedTuple = await this.doLoadFromCache();
    if (cachedTuple[0] !== null) {
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
      throw new TypeError('source is not set');
    }
    const value = await source.loadValue();
    await this.saveValue(value, source.expiration);
    return [value, source.expiration];
  }

  protected doDispose() {
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
    if (hasValue !== undefined) {
      // tslint:disable-next-line:no-parameter-reassignment
      hasValue = await this.hasCachedValue();
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
      if (!hasValue) {
        this._clearTimeout = setTimeout(() => throwAsyncIfAny(
          () => this.clearCache(),
          error => new CachedValueError(
            error, this, CacheEvent.CacheCleared
          )
        ).catch(error => this.emit('error', error)), now - newDate.valueOf());
      }
    }
    await this.updateExpiration(this._expiration);
  }
}
