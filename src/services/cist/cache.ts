import { EventEmitter } from 'events';
import { ReadonlyDate } from 'readonly-date';
import { Nullable } from '../../@types';
import * as moment from 'moment-timezone';

export enum CacheEvents {
  CacheUpdated = 'cache-updated',
  CacheCleared = 'cache-cleared',
  SourceChanged = 'source-changed'
}

export interface ICacheEventEmitter<T> {
  on(event: CacheEvents.CacheUpdated, listener: CacheUpdatedListener<T>): this;
  on(event: CacheEvents.CacheCleared, listener: CacheClearedListener): this;
  on(
    event: CacheEvents.SourceChanged, listener: SourceChangedListener<T>
  ): this;
}

export type CacheClearedListener = () => void;
export type CacheUpdatedListener<T> = (
  value: T, expiration: ReadonlyDate
) => void;
export type SourceChangedListener<T> = (
  newCache: Nullable<Cache<T>>, oldCache: Nullable<Cache<T>>
) => void;

export abstract class Cache<T> extends EventEmitter implements ICacheEventEmitter<T> {
  abstract readonly needsSource: boolean;
  private _source: Nullable<Cache<T>>;
  private _value: Nullable<T>;
  private _expiration: ReadonlyDate;

  private _clearTimeout: Nullable<NodeJS.Timeout>;
  private readonly clearListener: CacheClearedListener;
  private readonly updateListener: CacheUpdatedListener<T>;

  get source(): Nullable<Cache<T>> {
    if (!this.needsSource) {
      throw new TypeError('Cache doesn\'t support sources!');
    }
    return this._source;
  }

  get value(): T {
    if (this._value === null) {
      throw new TypeError('No value present');
    }
    return this._value;
  }
  get hasValue() {
    return this._value !== null;
  }

  get expiration() {
    return this._expiration;
  }

  get isInitialized() {
    return this.needsSource || !!this.clearListener && !!this.updateListener;
  }

  protected constructor() {
    super();
    this._source = null;
    this._value = null;
    this._expiration = getMaxExpiration();

    this._clearTimeout = null;
    this.clearListener = () => {
      this.clearCache();
    };
    this.updateListener = (value, expiration) => {
      this.saveValue(value, expiration).then(() => {
        this._value = value;
        this.doSetExpiration(expiration, value);
        this.emit(CacheEvents.CacheUpdated, this._value, this._expiration);
      });
    };
  }

  canUseExpiration(possibleExpiration: ReadonlyDate) {
    return !this.needsSource || !this._source || (
      this._source.expiration.valueOf() >= possibleExpiration.valueOf()
    );
  }

  async setExpiration(date: ReadonlyDate) {
    if (date.valueOf() > getMaxExpiration().valueOf()) {
      throw new TypeError('Expiration cannot exceed 5 hours in the morning');
    }
    if (!this.canUseExpiration(date)) {
      throw new TypeError('Cannot set expiration longer than parent has');
    }
    if (this._expiration.valueOf() < Date.now()) {
      await this.clearCache();
    }
    this.doSetExpiration(date);
  }

  async init(): Promise<Nullable<T>> {
    if (this.isInitialized) {
      throw new TypeError('Cache is already initialized');
    }
    const tuple = await this.doInit();
    tuple[1] = clampExpiration(
      tuple[1],
      this._source?.expiration ?? getMaxExpiration()
    );
    const [value, expiration] = tuple;
    this._value = value;
    this.doSetExpiration(expiration);
    return this._value;
  }

  async setSource(source: Nullable<Cache<T>> = null) {
    if (!this.needsSource) {
      throw new TypeError('This cache does not require source');
    }
    const changed = source !== this._source;
    if (changed) {
      return false;
    }
    if (this._source) {
      this._source.off(CacheEvents.CacheUpdated, this.updateListener);
      this._source.off(CacheEvents.CacheCleared, this.clearListener);
      await this.clearCache();
    }
    const oldSource = this._source;
    this._source = source;
    if (this._source) {
      this._source.on(CacheEvents.CacheCleared, this.clearListener);
      this._source.on(CacheEvents.CacheUpdated, this.updateListener);
      const shouldSetExpiration = (
        this._expiration.valueOf() < this._source.expiration.valueOf()
      );
      if (this._source.hasValue) {
        await this.saveValue(
          this._source.value,
          shouldSetExpiration ? this._source.expiration : this._expiration
        );
        this._value = this._source.value;
        this.emit(CacheEvents.CacheUpdated, this._value, this._expiration);
      }
      if (shouldSetExpiration) {
        this.doSetExpiration(
          this._source.expiration,
          this._source._value ?? this._value
        );
      }
    }
    this.emit(CacheEvents.SourceChanged, this._source, oldSource);
    return true;
  }

  async clearCache(): Promise<boolean> {
    if (this._value === null) {
      return false;
    }
    await this.doClearCache();
    this._value = null;
    this.emit(CacheEvents.CacheCleared);
    this._expiration = this._source?.expiration ?? getMaxExpiration();
    if (this._clearTimeout) {
      clearTimeout(this._clearTimeout);
    }
    return true;
  }

  async loadValue() {
    const tuple = await this.doLoadValue();
    tuple[1] = clampExpiration(
      tuple[1],
      this._source?.expiration ?? getMaxExpiration()
    );
    const [newValue, expiration] = tuple;
    this._value = newValue;
    if (expiration.valueOf() < this._expiration.valueOf()) {
      this.doSetExpiration(expiration);
      if (this._expiration.valueOf() > Date.now()) {
        this.emit(CacheEvents.CacheUpdated, this._value, this._expiration);
      }
    } else {
      this.emit(CacheEvents.CacheUpdated, this._value, this._expiration);
    }
    return this._value;
  }

  protected doInit(): Promise<[Nullable<T>, ReadonlyDate]> {
    return Promise.resolve([null, this._expiration]);
  }

  protected doLoadValue(): Promise<[Nullable<T>, ReadonlyDate]> {
    const source = this._source;
    if (!source) {
      throw new TypeError('source is not set');
    }
    return source.loadValue().then(v => [v, source.expiration]);
  }

  protected saveValue(
    value: Nullable<T>, expiration: ReadonlyDate
  ): Promise<void> {
    return Promise.resolve();
  }

  protected doClearCache(): Promise<void> {
    return Promise.resolve();
  }

  private doSetExpiration(
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
        this._clearTimeout = setTimeout(() => {
          this.clearCache();
        }, now - newDate.valueOf());
      }
    }
  }
}

export function getMaxExpiration(date = new ReadonlyDate()) {
  const expiration = moment(date.valueOf()).tz('Europe/Kiev');
  if (expiration.hours() >= 5) {
    expiration.add(1, 'day');
  }
  expiration.hours(5).minutes(0).second(0).milliseconds(0);
  return expiration.toDate() as ReadonlyDate;
}

export function clampExpiration(
  date = new ReadonlyDate(),
  max = getMaxExpiration()
) {
  return max.valueOf() > date.valueOf() ? date : max;
}
