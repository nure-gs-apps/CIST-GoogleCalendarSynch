"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const inversify_1 = require("inversify");
const types_1 = require("../../../di/types");
const fs_1 = require("fs");
const path = require("path");
const fs_2 = require("../../../utils/fs");
const google_1 = require("../../../utils/google");
exports.encoding = 'utf8';
let FileEventsTaskContextStorage = class FileEventsTaskContextStorage {
    constructor(fileName) {
        Object.defineProperty(this, "fileName", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.fileName = fileName;
    }
    exists() {
        return fs_2.fAccess(this.fileName, fs_1.constants.F_OK | fs_1.constants.R_OK | fs_1.constants.W_OK);
    }
    load() {
        return fs_1.promises.readFile(this.fileName, { encoding: exports.encoding })
            .then(text => google_1.eventsTaskContextFromSerializable(JSON.parse(text)));
    }
    async save(context) {
        await fs_1.promises.mkdir(path.dirname(this.fileName), { recursive: true });
        fs_1.writeFileSync(this.fileName, JSON.stringify(google_1.eventsTaskContextToSerializable(context)), { encoding: exports.encoding });
    }
    clear() {
        return fs_1.promises.unlink(this.fileName);
    }
};
FileEventsTaskContextStorage = tslib_1.__decorate([
    inversify_1.injectable(),
    tslib_1.__param(0, inversify_1.inject(types_1.TYPES.GoogleCalendarEventsTaskContextStorageFileName)),
    tslib_1.__metadata("design:paramtypes", [String])
], FileEventsTaskContextStorage);
exports.FileEventsTaskContextStorage = FileEventsTaskContextStorage;
//# sourceMappingURL=file.js.map