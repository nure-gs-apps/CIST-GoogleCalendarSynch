import { makePropertyEnumerable } from './utils/common';

export class MultiError extends Error {
  readonly errors: any[];

  constructor(message: string, errors: Iterable<any>) {
    super(message);
    this.errors = Array.from(errors);
  }
}

export class NestedError extends Error {
  readonly error: any;

  constructor(message: string, error: any) {
    super(message);
    this.error = error;
  }
}

export function makeJsonSerializable(
  error: Error,
  ...propertyNames: (keyof Error)[]
) {
  const properties: ReadonlyArray<keyof Error> = propertyNames.length > 0
    ? propertyNames
    : ['message', 'stack', 'name'];
  for (const property of properties) {
    makePropertyEnumerable(error, property);
  }
}
