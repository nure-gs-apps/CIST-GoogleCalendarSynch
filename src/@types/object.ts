import { Sema } from 'async-sema/lib';
import { injectable } from 'inversify';
import { asyncNoop } from '../utils/common';

export interface IDisposable {
  readonly isDisposed: boolean;

  dispose(): Promise<void>;
}

export function isDisposable(obj: object): obj is IDisposable {
  const value = obj as any;
  return typeof value.dispose === 'function'
    && typeof value.isDisposed === 'boolean';
}

export type DisposeFunction = () => any;

@injectable()
export class Disposer implements IDisposable {
  protected _isDisposed: boolean;
  protected _disposeSemaphore: Sema;

  get isDisposed() {
    return this._isDisposed;
  }

  constructor(disposer: DisposeFunction = asyncNoop) {
    this.doDispose = disposer;
    this._isDisposed = false;
    this._disposeSemaphore = new Sema(1);
  }

  async dispose(): Promise<void> {
    try {
      await this._disposeSemaphore.acquire();
      if (this.isDisposed) {
        return Promise.resolve();
      }
      await this.doDispose();
      this._isDisposed = true;
    } finally {
      this._disposeSemaphore.release();
    }
  }

  protected doDispose() {}
}

export const ASYNC_INIT: unique symbol = Symbol.for('@asyncInit');

export interface IAsyncInitializable {
  readonly [ASYNC_INIT]: Promise<any>;
}
