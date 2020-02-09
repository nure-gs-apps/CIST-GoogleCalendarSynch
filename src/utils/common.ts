import {camelCase, camelCaseTransformMerge} from "change-case";

export function arrayContentEqual<T>(
  first: ReadonlyArray<T>,
  second: ReadonlyArray<T>,
) {
  return first.length === second.length && first.every(e => second.includes(e));
}

export function toBase64(value: string) {
  return Buffer.from(value).toString('base64');
}

export function dateToSeconds(date: Date) {
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
