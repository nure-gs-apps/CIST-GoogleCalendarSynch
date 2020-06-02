import { ReadonlyDate } from 'readonly-date';
import { extends } from 'tslint/lib/configs/latest';

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

export interface DeepReadonlyArray<T> extends ReadonlyArray<DeepReadonly<T>> {
}

export interface DeepReadonlySet<T> extends ReadonlySet<DeepReadonly<T>> {
}

export interface DeepReadonlyMap<K, V> extends ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>> {
}

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
    : T extends Map<infer K, infer V> ? Map<DeepPartial<K>, DeepPartial<V>>
    : T extends Set<infer V> ? Set<DeepPartial<V>>
      : T extends (infer V)[] ? DeepPartial<V>[]
        : T extends ReadonlyMap<infer K, infer V>
          ? ReadonlyMap<DeepPartial<K>, DeepPartial<V>>
          : T extends ReadonlySet<infer V> ? ReadonlySet<DeepPartial<V>>
            : T extends ReadonlyArray<infer V> ? ReadonlyArray<DeepPartial<V>>
              : DeepPartialObject<T>;
export type DeepPartialObject<T> = {
  [P in keyof T]?: DeepPartial<T[P]>;
};
export type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

export function t<A>(...args: [A]): [A];
export function t<A, B>(...args: [A, B]): [A, B];
export function t<A, B, C>(...args: [A, B, C]): [A, B, C];
export function t(...args: any[]): any[] {
  return args;
}

export interface IReadonlyGuardedMap<K, V> extends ReadonlyMap<K, NonOptional<V>> {
  get<K>(key: K): NonOptional<V>;
  forEach(
    callbackfn: (value: NonOptional<V>, key: K, map: GuardedMap<K, V>) => void,
    thisArg?: any,
  ): void;
}

export interface IGuardedMap<K, V> extends IReadonlyGuardedMap<K, V>{
  set<K>(key: K, value: NonOptional<V>): any;
}

export class GuardedMap<K, V> extends Map<any, any> implements IReadonlyGuardedMap<K, V>, Map<K, NonOptional<V>>, IGuardedMap<K, V> {
  get<K>(key: K): NonOptional<V> {
    const value = super.get(key);
    if (value === undefined) {
      throw new TypeError(`key ${key} is not found in the map`);
    }
    return value;
  }

  set<K>(key: K, value: NonOptional<V>) {
    if (value === undefined) {
      throw new TypeError(`value ${value} for key ${key} is undefined`);
    }
    return super.set(key, value);
  }

  forEach(
    callbackfn: (value: NonOptional<V>, key: K, map: GuardedMap<K, V>) => void,
    thisArg?: any,
  ) {
    return super.forEach(callbackfn, thisArg);
  }
}

