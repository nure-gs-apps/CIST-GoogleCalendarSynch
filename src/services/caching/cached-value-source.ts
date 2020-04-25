import { ReadonlyDate } from 'readonly-date';
import { Nullable } from '../../@types';
import { CachedValue } from './cached-value';

export abstract class CachedValueSource<T> extends CachedValue<T> {
  readonly isDestroyable = false;
  readonly needsInit = false;
  readonly needsSource = false;

  // tslint:disable-next-line:max-line-length
  protected doLoadValue(): Promise<[Nullable<T>, ReadonlyDate]> {
    return this.doLoadFromCache();
  }

  protected doClearCache(): Promise<boolean> {
    return Promise.resolve(false);
  }

  // tslint:disable-next-line:max-line-length
  protected abstract doLoadFromCache(): Promise<[Nullable<T>, ReadonlyDate]>;

  protected hasCachedValue(): Promise<boolean> {
    return Promise.resolve(true);
  }

  protected loadExpirationFromCache(): Promise<ReadonlyDate> {
    return Promise.resolve(this._utils.getMaxExpiration());
  }
}
