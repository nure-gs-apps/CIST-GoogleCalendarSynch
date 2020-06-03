import { camelCase, camelCaseTransformMerge } from 'change-case';
import iterate from 'iterare';
import { isObjectLike as _isObjectLike } from 'lodash';
import { ReadonlyDate } from 'readonly-date';
import { ApiGroup, ApiGroupsResponse } from '../@types/cist';
import { ICrossPlatformFilePath } from '../@types/utils';

export function arrayContentEqual<T>(
  first: ReadonlyArray<T>,
  second: ReadonlyArray<T>,
) {
  return first.length === second.length && first.every(e => second.includes(e));
}

export function toBase64(value: string) {
  return Buffer.from(value).toString('base64');
}

export function dateToSeconds(date: ReadonlyDate) {
  return Math.round(date.getTime() / 1000);
}

export const camelCaseStripRegex = /[^A-Z0-9$]/gi;
export function commonCamelCase(value: string) {
  return camelCase(value, {
    transform: camelCaseTransformMerge,
    stripRegexp: camelCaseStripRegex
  });
}

export function* objectValues<V>(
  object: Record<any, V>,
  onlyOwnProperties = true
) {
  // tslint:disable-next-line:forin
  for (const prop in object) {
    if (onlyOwnProperties && !object.hasOwnProperty(prop)) {
      continue;
    }
    yield object[prop];
  }
}

export function* objectKeys<K extends string | number | symbol>(
  object: Record<K, any>,
  onlyOwnProperties = true
) {
  // tslint:disable-next-line:forin
  for (const prop in object) {
    if (onlyOwnProperties && !object.hasOwnProperty(prop)) {
      continue;
    }
    yield prop;
  }
}

export function* objectEntries<K extends string | number | symbol, V>(
  object: Record<K, V>,
  onlyOwnProperties = true
): Generator<[K, V]> {
  // tslint:disable-next-line:forin
  for (const prop in object) {
    if (onlyOwnProperties && !object.hasOwnProperty(prop)) {
      continue;
    }
    yield [prop, object[prop]];
  }
}

export type AsyncFunction<A extends any[] = any[], R = any> = (...args: A) => Promise<R>;
export function normalizeErrorIfAny<A extends any[] = any, R = any, E = any>(
  fn: AsyncFunction<A, R>, mapError: (err: any) => E, ...args: A
): Promise<R> | never {
  try {
    return fn(...args).catch(err => {
      throw mapError(err);
    });
  } catch (err) {
    throw mapError(err);
  }
}
export function throwAsyncIfAny<A extends any[] = any, R = any, E = any>(
  fn: AsyncFunction<A, R>, mapError: (err: any) => E, ...args: A
): Promise<R> {
  try {
    return fn(...args).catch(err => {
      throw mapError(err);
    });
  } catch (err) {
    return Promise.reject(mapError(err));
  }
}

export function isObjectLike<T extends object>(value: unknown): value is T {
  return _isObjectLike(value);
}

export function asyncNoop() {
  return Promise.resolve();
}

export function isWindows() {
  return process.platform === 'win32';
}

export namespace PathUtils {
  export function getPath(path: ICrossPlatformFilePath) {
    return isWindows() ? path.win : path.unix;
  }

  export const expandVars = isWindows()
    ? function expandVars(path: string) {
      return path.replace(/\^?%[\w\d]+\^?%/g, matched => {
        const escapedFirst = matched[0] === '^';
        const escapedLast = matched[matched.length - 2] === '^';
        if (escapedFirst && escapedLast) {
          return matched.slice(1, -2) + matched[matched.length - 1];
        }
        const variable = matched.slice(
          escapedFirst ? 2 : 1,
          escapedLast ? -2 : -1,
        );
        return process.env[variable] ?? '';
      });
    }
    : function expandVars(path: string) {
      return path.replace(/\\?\$[\w\d]+/g, matched => {
        if (matched[0] === '\\') {
          return matched.slice(1);
        }
        const variable = matched.slice(1);
        return process.env[variable] ?? '';
      });
    };
}

export function toPrintString(strings: ReadonlyArray<unknown>) {
  return `"${strings.join('", "')}"`;
}

export function makePropertyEnumerable<T extends object = object>(object: T, property: keyof T) {
  const descriptor = Object.getOwnPropertyDescriptor(object, property);
  if (descriptor && !descriptor.enumerable) {
    descriptor.enumerable = true;
    Object.defineProperty(object, property, descriptor);
  }
}

export function toGroupIds(groupsResponse: ApiGroupsResponse) {
  return iterate(groupsResponse.university.faculties)
    .map(f => f.directions)
    .flatten()
    .filter(d => !!d.groups)
    .map(d => d.groups as ApiGroup[])
    .flatten()
    .map(g => g.id);
}

export function isIterable(value: any): value is Iterable<any> {
  return isObjectLike<Iterable<any>>(value)
    && typeof value[Symbol.iterator] === 'function';
}
