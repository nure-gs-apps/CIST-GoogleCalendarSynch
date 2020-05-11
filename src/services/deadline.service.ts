import { ReadonlyDate } from 'readonly-date';

export class DeadlineService {
  readonly deadline: ReadonlyDate;

  constructor(deadline: ReadonlyDate) {
    if (deadline.valueOf() < Date.now()) {
      throw new TypeError(`${DeadlineService}: ${deadline.toISOString()} has already passed`);
    }
    this.deadline = deadline;
  }

  hasTime() {
    return this.deadline.valueOf() >= Date.now();
  }
}
