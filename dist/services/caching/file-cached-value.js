"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("../../utils/common");
const cached_value_1 = require("./cached-value");
const graceful_fs_1 = require("graceful-fs");
const proper_lockfile_1 = require("proper-lockfile");
const expirationSeparatorChar = '$';
const separatorPosition = new Date().toISOString().length;
const encoding = 'utf8';
const valueOffset = separatorPosition + expirationSeparatorChar.length;
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
            value: _fileName
        });
        Object.defineProperty(this, "file", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: file
        });
        Object.defineProperty(this, "unlock", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: unlock
        });
        this._fileName = fileName;
        this.unlock = common_1.asyncNoop;
        this.file = null;
    }
    async doInit() {
        if (!await this.canAccessFile()) {
            throw new Error(`Cache file ${this._fileName} is not accessible for read and write`);
        }
        this.unlock = await proper_lockfile_1.lock(this._fileName, {
            stale: 60000,
            update: 5000,
        });
        this.file = await graceful_fs_1.promises.open(this._fileName, 'r+', 666);
        if ((await this.file.stat()).size < separatorPosition) {
            await this.writeExpiration();
        }
    }
    async doDispose() {
        var _a;
        await ((_a = this.file) === null || _a === void 0 ? void 0 : _a.close());
        this.file = null;
        await this.unlock();
    }
    async canAccessFile() {
        return graceful_fs_1.promises.access(this._fileName, graceful_fs_1.constants.F_OK | graceful_fs_1.constants.R_OK | graceful_fs_1.constants.W_OK).catch(() => true);
    }
    async updateExpiration(date) {
        if (!this.file) {
            throw new TypeError('Invalid state, file is not loaded');
        }
        const { bytesWritten } = await this.file.write(date.toISOString(), 0);
        if (separatorPosition !== bytesWritten) {
            throw new TypeError(`Bad write to file, expected ${separatorPosition} bytes to be written, got ${bytesWritten}`);
        }
    }
    async doLoadFromCache() {
        if (!this.file) {
            throw new TypeError('Invalid state, file is not loaded');
        }
        const fileContent = await this.file.readFile(encoding);
        const expiration = parseExpiration(fileContent);
        if (fileContent[separatorPosition] !== expirationSeparatorChar) {
            throw new TypeError(`Invalid expiration separator found. Expected ${expirationSeparatorChar}, found ${fileContent[separatorPosition]}`);
        }
        const stringValue = fileContent.slice(separatorPosition + 1);
        if (stringValue.length === 0) {
            return [null, expiration];
        }
        return [JSON.parse(stringValue), expiration];
    }
    async saveValue(value, expiration) {
        if (!this.file) {
            throw new TypeError('Invalid state, file is not loaded');
        }
        await this.writeExpiration(expiration);
        await this.file.write(expirationSeparatorChar, separatorPosition, encoding);
        if (value !== null) {
            await this.file.write(JSON.stringify(value), separatorPosition + 1, encoding);
        }
    }
    hasCachedValue() {
        return Promise.resolve(false);
    }
    async loadExpirationFromCache() {
        if (!this.file) {
            throw new TypeError('Invalid state, file is not loaded');
        }
        const buffer = new Buffer(valueOffset);
        await this.file.read(buffer, 0, valueOffset, 0);
        return Promise.resolve(parseExpiration(buffer.toString(encoding)));
    }
    async doClearCache() {
        if (!this.file) {
            throw new TypeError('Invalid state, file is not loaded');
        }
        if (valueOffset <= (await this.file.stat()).size) {
            return false;
        }
        await this.file.truncate(valueOffset);
        return true;
    }
    async writeExpiration(expiration = this._utils.getMaxExpiration()) {
        if (!this.file) {
            throw new TypeError('Invalid state, file is not loaded');
        }
        await this.file.write(expiration.toISOString(), 0, encoding);
        await this.file.write(expirationSeparatorChar, separatorPosition, encoding);
    }
}
exports.FileCachedValue = FileCachedValue;
function parseExpiration(fileContent) {
    const expiration = new Date(fileContent.slice(0, separatorPosition));
    if (Number.isNaN(expiration.valueOf())) {
        throw new TypeError(`Invalid expiration: ${fileContent.slice(0, separatorPosition)}`);
    }
    return expiration;
}
//# sourceMappingURL=file-cached-value.js.map