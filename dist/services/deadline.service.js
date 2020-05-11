"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class DeadlineService {
    constructor(deadline) {
        Object.defineProperty(this, "deadline", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        if (deadline.valueOf() < Date.now()) {
            throw new TypeError(`${DeadlineService}: ${deadline.toISOString()} has already passed`);
        }
        this.deadline = deadline;
    }
    hasTime() {
        return this.deadline.valueOf() >= Date.now();
    }
}
exports.DeadlineService = DeadlineService;
//# sourceMappingURL=deadline.service.js.map