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
        fs_1.writeFileSync(this.fileName, JSON.stringify(tasks), {
            encoding: exports.encoding
        }); // No other way to write in async way from signal listener
        return Promise.resolve();
    }
    async loadAndClear() {
        const tasks = await this.load();
        await this.clear();
        return tasks;
    }
    async load() {
        return fs_1.promises.readFile(this.fileName, { encoding: exports.encoding })
            .then(text => JSON.parse(text));
    }
    async clear() {
        return fs_1.promises.unlink(this.fileName);
    }
};
TaskProgressFileBackend = tslib_1.__decorate([
    inversify_1.injectable(),
    tslib_1.__param(0, inversify_1.inject(types_1.TYPES.TaskProgressFileBackendFileName)),
    tslib_1.__metadata("design:paramtypes", [String])
], TaskProgressFileBackend);
exports.TaskProgressFileBackend = TaskProgressFileBackend;
//# sourceMappingURL=file.js.map