export interface IDisposable {
  readonly isDisposed: boolean;

  dispose(): Promise<void>;
}

export function isDisposable(obj: object): obj is IDisposable {
  const value = obj as any;
  return typeof value.dispose === 'function'
    && typeof value.isDisposed === 'boolean';
}

export const ASYNC_INIT: unique symbol = Symbol.for('@asyncInit');

export interface IAsyncInitializable {
  readonly [ASYNC_INIT]: Promise<any>;
}
