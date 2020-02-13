import { ReadonlyDate } from 'readonly-date';

export type primitive =
  number
  | string
  | boolean
  | symbol
  | bigint;

export type Maybe<T> = T | null | undefined;
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;

export type NonOptional<T> = T extends undefined ? never : T;

export const asReadonly = Symbol('asReadonly');
export interface IReadonlyMarker<RT> {
  /**
   * WARNING: This symbol is used for compile time checks and is unsafe to read.
   *   You can read it only if you are sure that the type that implements the
   *   interface allows you to.
   */
  [asReadonly]: RT;
}

export type DeepReadonly<T> =
  T extends IReadonlyMarker<infer RT> ? T[typeof asReadonly]
    : T extends Date ? ReadonlyDate
    : T extends ReadonlyMap<infer K, infer V> ? DeepReadonlyMap<K, V>
      // tslint:disable-next-line:no-shadowed-variable
      : T extends ReadonlySet<infer V> ? DeepReadonlySet<V>
        // tslint:disable-next-line:no-shadowed-variable
        : T extends ReadonlyArray<infer V> ? DeepReadonlyArray<V>
          : DeepReadonlyObject<T>;

export type DeepReadonlyObject<T> = {
  readonly [P in keyof T]: DeepReadonly<T[P]>;
};
export interface DeepReadonlyArray<T> extends ReadonlyArray<
  DeepReadonly<T>
  > { }
export interface DeepReadonlySet<T> extends ReadonlySet<DeepReadonly<T>> { }
export interface DeepReadonlyMap<K, V> extends ReadonlyMap<
  DeepReadonly<K>, DeepReadonly<V>
  > { }

export const asPartial = Symbol('asPartial');
export interface IPartialMarker<P> {
  /**
   * WARNING: This symbol is used for compile time checks and is unsafe to read.
   *   You can read it only if you are sure that the type that implements the
   *   interface allows you to.
   */
  [asPartial]: P;
}
export type DeepPartial<T> =
  T extends IPartialMarker<infer PT> ? T[typeof asPartial]
    : T extends ReadonlyArray<infer V> ? ReadonlyArray<DeepReadonly<V>>
    // tslint:disable-next-line:no-shadowed-variable
    : T extends (infer V)[] ? DeepReadonly<V>[]
      : DeepPartialObject<T>;

export type DeepPartialObject<T> = {
  [P in keyof T]?: DeepPartial<T[P]>;
};

export type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

export interface IApiQuota {
  daily: number;
  period: number;
  queries: number;
  perSecond?: number;
  burst: boolean;
}

export interface ICalendarConfig {
  prefix: Nullable<string>;
  timeZone: string;
}
