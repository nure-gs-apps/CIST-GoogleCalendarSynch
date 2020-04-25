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

