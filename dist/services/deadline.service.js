"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const jobs_1 = require("../utils/jobs");
var DeadlineServiceEventNames;
(function (DeadlineServiceEventNames) {
    DeadlineServiceEventNames["Deadline"] = "deadline";
})(DeadlineServiceEventNames = exports.DeadlineServiceEventNames || (exports.DeadlineServiceEventNames = {}));
class DeadlineService extends events_1.EventEmitter {
    constructor(duration) {
        if (duration.asMilliseconds() <= 0) {
            throw new TypeError(`${DeadlineService.name}: duration "${duration.toISOString()}" cannot be negative`);
        }
        super();
        Object.defineProperty(this, "deadline", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_timeout", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.deadline = jobs_1.toDeadlineDate(duration);
        this._timeout = setTimeout(() => this.emit(DeadlineServiceEventNames.Deadline, this), duration.asMilliseconds());
    }
    get isDisposed() {
        return !this._timeout;
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
exports.DeadlineService = DeadlineService;
//# sourceMappingURL=deadline.service.js.map