"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("../../utils/common");
const cached_value_1 = require("./cached-value");
const graceful_fs_1 = require("graceful-fs");
const proper_lockfile_1 = require("proper-lockfile");
const valueOffset = new Date().toISOString().length;
const encoding = 'utf8';
class FileCachedValue extends cached_value_1.CachedValue {
    constructor(utils, fileName) {
        super(utils);
        Object.defineProperty(this, "needsSource", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: true
        });
        Object.defineProperty(this, "needsInit", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: true
        });
        Object.defineProperty(this, "_fileName", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_file", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "unlock", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._fileName = fileName;
        this.unlock = common_1.asyncNoop;
        this._file = null;
    }
    async doInit() {
        let fileStats = null;
        try {
            fileStats = await graceful_fs_1.promises.stat(this._fileName);
        }
        catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }
        if (fileStats) {
            if (!fileStats.isFile()) {
                throw new TypeError(`${this._fileName} is expected to be a file`);
            }
            if (!graceful_fs_1.promises.access(this._fileName, graceful_fs_1.constants.F_OK | graceful_fs_1.constants.R_OK | graceful_fs_1.constants.W_OK).then(() => true).catch(() => false)) {
                throw new Error(`Cache file ${this._fileName} is not accessible for read and write`);
            }
        }
        this._file = await graceful_fs_1.promises.open(this._fileName, fileStats ? 'r+' : 'w+', 0o666);
        try {
            this.unlock = await proper_lockfile_1.lock(this._fileName, {
                stale: 60000,
                update: 5000,
            });
        }
        catch (error) {
            await this._file.close();
            this._file = null;
            throw error;
        }
        fileStats = fileStats !== null && fileStats !== void 0 ? fileStats : await this._file.stat();
        if (fileStats.size < valueOffset) {
            await this.writeExpiration();
        }
    }
    async doDispose() {
        var _a;
        await ((_a = this._file) === null || _a === void 0 ? void 0 : _a.close());
        this._file = null;
        await this.unlock();
    }
    async updateExpiration(date) {
        if (!this._file) {
            throw new TypeError('Invalid state, file is not loaded');
        }
        const { bytesWritten } = await this._file.write(date.toISOString(), 0);
        if (valueOffset !== bytesWritten) {
            throw new TypeError(`Bad write to file, expected ${valueOffset} bytes to be written, got ${bytesWritten}`);
        }
    }
    async doLoadFromCache() {
        if (!this._file) {
            throw new TypeError('Invalid state, file is not loaded');
        }
        const fileContent = await this._file.readFile(encoding);
        const expiration = parseExpiration(fileContent);
        const stringValue = fileContent.slice(valueOffset);
        if (stringValue.length === 0) {
            return [null, expiration];
        }
        return [JSON.parse(stringValue), expiration];
    }
    async saveValue(value, expiration) {
        if (!this._file) {
            throw new TypeError('Invalid state, file is not loaded');
        }
        await this.writeExpiration(expiration);
        if (value !== null) {
            await this._file.write(JSON.stringify(value), valueOffset, encoding);
        }
        else {
            await this._file.truncate(valueOffset);
        }
    }
    hasCachedValue() {
        return Promise.resolve(false);
    }
    async loadExpirationFromCache() {
        if (!this._file) {
            throw new TypeError('Invalid state, file is not loaded');
        }
        const buffer = Buffer.alloc(valueOffset);
        await this._file.read(buffer, 0, valueOffset, 0);
        return Promise.resolve(parseExpiration(buffer.toString(encoding)));
    }
    async doClearCache() {
        if (!this._file) {
            throw new TypeError('Invalid state, file is not loaded');
        }
        if (valueOffset <= (await this._file.stat()).size) {
            return false;
        }
        await this._file.truncate(valueOffset);
        return true;
    }
    async writeExpiration(expiration = this._utils.getMaxExpiration()) {
        if (!this._file) {
            throw new TypeError('Invalid state, file is not loaded');
        }
        await this._file.write(expiration.toISOString(), 0, encoding);
    }
}
exports.FileCachedValue = FileCachedValue;
function parseExpiration(fileContent) {
    const expiration = new Date(fileContent.slice(0, valueOffset));
    if (Number.isNaN(expiration.valueOf())) {
        throw new TypeError(`Invalid expiration: ${fileContent.slice(0, valueOffset)}`);
    }
    return expiration;
}
//# sourceMappingURL=file-cached-value.js.map