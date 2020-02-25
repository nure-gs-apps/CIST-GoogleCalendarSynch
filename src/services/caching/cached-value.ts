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
  readonly value: Nullable<T>;
  readonly expiration: ReadonlyDate;
  init(loadFromCache?: true): Promise<boolean>;
  init(loadFromCache: boolean): Promise<boolean>;
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
  private _value: Nullable<T>;
  private _expiration: ReadonlyDate;
  private _isInitialized: boolean;

  private _clearTimeout: Nullable<NodeJS.Timeout>;
  private readonly clearListener: CacheClearedListener;
  private readonly updateListener: CacheUpdatedListener<T>;
  private readonly errorListener: CacheErrorListener<T>;

  get source(): Nullable<CachedValue<T>> {
    if (!this.needsSource) {
      throw new TypeError('CachedValue doesn\'t support sources!');
    }
    return this._source;
  }

  get value(): Nullable<T> {
    return this._value;
  }

  get expiration() {
    return this._expiration;
  }

  get isInitialized() {
    return this.needsInit && this._isInitialized;
  }

  get isDisposed() {
    return !this.isInitialized;
  }

  protected constructor(utils: CacheUtilsService) {
    super();
    this[asReadonly] = this;
    this._utils = utils;
    this._source = null;
    this._value = null;
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
        this._value = value;
        return this.doSetExpiration(expiration, value);
      }).then(() => {
        this.emit(CacheEvent.CacheUpdated, this._value, this._expiration);
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
    if (date.valueOf() > this._utils.getMaxExpiration().valueOf()) {
      throw new TypeError('Expiration cannot exceed 5 hours in the morning');
    }
    if (!this.canUseExpiration(date)) {
      throw new TypeError('Cannot set expiration longer than parent has');
    }
    if (this._expiration.valueOf() < Date.now()) {
      await this.clearCache();
    }
    await this.doSetExpiration(date);
  }

  async init(loadFromCache = true): Promise<boolean> {
    const shouldInit = this.needsInit && !this.isInitialized;
    if (shouldInit) {
      await this.doInit();
      this._isInitialized = true;
    }
    if (loadFromCache) {
      await this.loadFromCache();
    }
    return shouldInit;
  }

  async setSource(source: Nullable<CachedValue<T>> = null) {
    if (!this.needsSource) {
      throw new TypeError('This CachedValue does not require source');
    }
    const changed = source !== this._source;
    if (changed) {
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
      const shouldSetExpiration = (
        this._expiration.valueOf() < this._source.expiration.valueOf()
      );
      if (this._source.value) {
        await this.saveValue(
          this._source.value,
          shouldSetExpiration ? this._source.expiration : this._expiration
        );
        this._value = this._source.value;
        this.emit(CacheEvent.CacheUpdated, this._value, this._expiration);
      }
      if (shouldSetExpiration) {
        await this.doSetExpiration(
          this._source.expiration,
          this._source._value ?? this._value
        );
      }
    }
    this.emit(CacheEvent.SourceChanged, this._source, oldSource);
    return true;
  }

  async clearCache(): Promise<boolean> {
    if (this._value === null) {
      return false;
    }
    await this.doClearCache();
    this._value = null;
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
    this._value = newValue;
    if (expiration.valueOf() < this._expiration.valueOf()) {
      await this.doSetExpiration(expiration);
      if (this._expiration.valueOf() > Date.now()) {
        this.emit(CacheEvent.CacheUpdated, this._value, this._expiration);
      }
    } else {
      this.emit(CacheEvent.CacheUpdated, this._value, this._expiration);
    }
    return this._value;
  }

  async loadFromCache(): Promise<Nullable<T>> {
    if (!this.needsSource) {
      throw new TypeError('This CachedValue does not require source');
    }
    const tuple = await this.doLoadFromCache();
    tuple[1] = this._utils.clampExpiration(
      tuple[1],
    this._source?.expiration ?? this._utils.getMaxExpiration()
    );
    const [value, expiration] = tuple;
    this._value = value;
    await this.doSetExpiration(expiration);
    return this._value;
  }

  async dispose() {
    if (this.isDisposed) {
      return;
    }
    await this.doDispose();
    this._isInitialized = false;
  }

  protected doInit(): Promise<void> {
    return Promise.resolve();
  }

  protected doLoadValue(): Promise<[Nullable<T>, ReadonlyDate]> {
    return this.loadValueFromSource();
  }

  protected doLoadFromCache(): Promise<[Nullable<T>, ReadonlyDate]> {
    return Promise.resolve([this._value, this._expiration]);
  }

  protected updateExpiration(date: ReadonlyDate): Promise<void> {
    return Promise.resolve();
  }

  protected loadValueFromSource(): Promise<[Nullable<T>, ReadonlyDate]> {
    const source = this._source;
    if (!source) {
      throw new TypeError('source is not set');
    }
    return source.loadValue().then(v => [v, source.expiration]);
  }

  protected doDispose() {
    return Promise.resolve();
  }

  protected saveValue(
    value: Nullable<T>, expiration: ReadonlyDate
  ): Promise<void> {
    return Promise.resolve();
  }

  protected doClearCache(): Promise<void> {
    return Promise.resolve();
  }

  private async doSetExpiration(
    newDate: ReadonlyDate,
    value: Nullable<T> = this._value
  ) {
    if (newDate.valueOf() === this._expiration.valueOf()) {
      return;
    }
    this._expiration = newDate;
    if (this._clearTimeout) {
      clearTimeout(this._clearTimeout);
    }
    const now = Date.now();
    if (newDate.valueOf() > now) {
      if (value === null) {
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
