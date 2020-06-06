import { EventEmitter } from 'events';
import { Duration } from 'moment';
import { ReadonlyDate } from 'readonly-date';
import { Nullable } from '../@types';
import { IDisposable } from '../@types/object';
import { toDeadlineDate } from '../utils/jobs';

export enum DeadlineServiceEventNames {
  Deadline = 'deadline'
}

export interface IDeadlineNotifier {
  on(
    event: DeadlineServiceEventNames.Deadline,
    handler: (context: this) => any,
  ): this;
}

export class DeadlineService extends EventEmitter implements IDisposable, IDeadlineNotifier {
  readonly deadline: ReadonlyDate;
  private _timeout: Nullable<NodeJS.Timeout>;

  get isDisposed() {
    return !this._timeout;
  }

  constructor(duration: Duration) {
    if (duration.asMilliseconds() <= 0) {
      throw new TypeError(`${DeadlineService.name}: duration "${duration.toISOString()}" cannot be negative`);
    }
    super();
    this.deadline = toDeadlineDate(duration);
    this._timeout = setTimeout(
      () => this.emit(DeadlineServiceEventNames.Deadline, this),
      duration.asMilliseconds(),
    );
  }

  hasTime() {
    return this.deadline.valueOf() >= Date.now();
  }

  dispose() {
    if (this._timeout) {
      clearTimeout(this._timeout);
      this._timeout = null;
    }
    return Promise.resolve();
  }
}
