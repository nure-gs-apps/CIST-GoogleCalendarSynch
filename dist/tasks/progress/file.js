"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const inversify_1 = require("inversify");
const types_1 = require("../../di/types");
const fs_1 = require("fs");
exports.encoding = 'utf8';
let TaskProgressFileBackend = class TaskProgressFileBackend {
    constructor(fileName) {
        Object.defineProperty(this, "fileName", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.fileName = fileName;
    }
    save(tasks) {
        return fs_1.promises.writeFile(this.fileName, JSON.stringify(tasks), {
            encoding: exports.encoding
        });
    }
    async loadAndClear() {
        const tasks = await fs_1.promises.readFile(this.fileName, { encoding: exports.encoding })
            .then(text => JSON.parse(text));
        await fs_1.promises.unlink(this.fileName);
        return tasks;
    }
};
TaskProgressFileBackend = tslib_1.__decorate([
    tslib_1.__param(0, inversify_1.inject(types_1.TYPES.TaskProgressFileBackendFileName)),
    tslib_1.__metadata("design:paramtypes", [String])
], TaskProgressFileBackend);
exports.TaskProgressFileBackend = TaskProgressFileBackend;
//# sourceMappingURL=file.js.map