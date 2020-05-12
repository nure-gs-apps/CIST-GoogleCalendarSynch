import { ReadonlyDate } from 'readonly-date';
import { Nullable } from '../../@types';
import { CacheUtilsService } from './cache-utils.service';
import {
  CachedValue,
  IReadonlyCachedValue,
} from './cached-value';

export interface IReadonlyMemoryCachedValue<T> extends IReadonlyCachedValue<T> {
  readonly value: Nullable<T>;
}

export class MemoryCachedValue<T> extends CachedValue<T> {
  readonly isDestroyable = false;
  readonly needsInit = true;
  readonly needsSource = true;
  private _value: Nullable<T>;

  get [Symbol.toStringTag]() {
    return MemoryCachedValue.name;
  }

  get value(): Nullable<T> {
    return this._value;
  }

  protected constructor(utils: CacheUtilsService) {
    super(utils);
    this._value = null;
  }

  protected async doClearCache(): Promise<boolean> {
    if (this._value === null) {
      return false;
    }
    this._value = null;
    return true;
  }

  protected doLoadFromCache(): Promise<[Nullable<T>, ReadonlyDate]> {
    return Promise.resolve([this._value, this.expiration]);
  }

  protected hasCachedValue(): Promise<boolean> {
    return Promise.resolve(this._value !== null);
  }

  protected loadExpirationFromCache(): Promise<ReadonlyDate> {
    return Promise.resolve(this._utils.getMaxExpiration());
  }

  protected doSaveValue(
    value: Nullable<T>,
    expiration: ReadonlyDate,
  ): Promise<void> {
    this._value = value;
    return Promise.resolve();
  }
}
