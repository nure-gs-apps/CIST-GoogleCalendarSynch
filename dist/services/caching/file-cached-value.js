"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("../../utils/common");
const fs_1 = require("../../utils/fs");
const cached_value_1 = require("./cached-value");
const graceful_fs_1 = require("graceful-fs");
const proper_lockfile_1 = require("proper-lockfile");
const encoding = 'utf8';
const expirationSeparator = '\n';
const expirationSeparatorBuffer = Buffer.from(expirationSeparator, encoding);
const expirationBufferSize = Buffer.from(new Date().toISOString(), encoding).length + expirationSeparatorBuffer.length;
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
                throw new TypeError(this.l('is expected to be a file'));
            }
            if (!graceful_fs_1.promises.access(this._fileName, graceful_fs_1.constants.F_OK | graceful_fs_1.constants.R_OK | graceful_fs_1.constants.W_OK).then(() => true).catch(() => false)) {
                throw new Error(this.l(`Cache file ${this._fileName} is not accessible for read and write`));
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
            await this.doDispose();
            throw error;
        }
        fileStats = fileStats !== null && fileStats !== void 0 ? fileStats : await this._file.stat();
        if (fileStats.size < expirationBufferSize) {
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
            throw new TypeError(this.l('Invalid state, file is not loaded'));
        }
        await this.writeExpiration(date);
    }
    async doLoadFromCache() {
        if (!this._file) {
            throw new TypeError(this.l('Invalid state, file is not loaded'));
        }
        // const { contents, found } = await fReadUntil(this._file, expirationSeparatorBuffer, 0);
        // const b = contents.toString(encoding);
        // console.log(b, found);
        const fileContents = await fs_1.fReadFile(this._file, encoding);
        const separatorIndex = fileContents.indexOf(expirationSeparator);
        if (separatorIndex < 0) {
            throw new TypeError(this.l('Invalid format, no expiration separator'));
        }
        const expiration = this.parseExpiration(fileContents.slice(0, separatorIndex));
        const stringValue = fileContents.slice(separatorIndex + expirationSeparatorBuffer.length);
        if (stringValue.length === 0) {
            return [null, expiration];
        }
        return [JSON.parse(stringValue), expiration];
    }
    async saveValue(value, expiration) {
        if (!this._file) {
            throw new TypeError(this.l('Invalid state, file is not loaded'));
        }
        const bytesWritten = await this.writeExpiration(expiration, false);
        if (value !== null) {
            await this._file.write(JSON.stringify(value), bytesWritten, encoding);
        }
        else {
            await this._file.truncate(bytesWritten);
        }
    }
    hasCachedValue() {
        return Promise.resolve(false);
    }
    async loadExpirationFromCache() {
        if (!this._file) {
            throw new TypeError(this.l('Invalid state, file is not loaded'));
        }
        const { contents } = await fs_1.fReadUntil(this._file, expirationSeparatorBuffer, 0, expirationBufferSize);
        return Promise.resolve(this.parseExpiration(contents.toString(encoding)));
    }
    async doClearCache() {
        if (!this._file) {
            throw new TypeError(this.l('Invalid state, file is not loaded'));
        }
        if (expirationBufferSize <= await fs_1.fSize(this._file)) {
            return false;
        }
        await this._file.truncate((await fs_1.fReadUntil(this._file, expirationSeparatorBuffer)).contents.length + expirationSeparatorBuffer.length);
        return true;
    }
    async writeExpiration(expiration = this._utils.getMaxExpiration(), preserveContents = true) {
        if (!this._file) {
            throw new TypeError(this.l('Invalid state, file is not loaded'));
        }
        const expirationBuffer = Buffer.from(expiration.toISOString(), encoding);
        if (preserveContents) {
            const { contents, found } = await fs_1.fReadUntil(this._file, expirationSeparatorBuffer, 0, expirationBufferSize);
            if (found) {
                if (contents.length > expirationBuffer.length) {
                    const cutOutLength = expirationBuffer.length - contents.length;
                    await fs_1.fCutOut(this._file, contents.length + expirationSeparatorBuffer.length - cutOutLength, cutOutLength, await fs_1.fSize(this._file));
                }
                else if (contents.length < expirationBuffer.length) {
                    const offset = expirationBuffer.length - contents.length;
                    await fs_1.fShiftForward(this._file, contents.length + expirationSeparatorBuffer.length, offset, await fs_1.fSize(this._file));
                }
            }
        }
        const bufferToWrite = Buffer.concat([
            expirationBuffer,
            expirationSeparatorBuffer,
        ]);
        await this._file.write(bufferToWrite, 0, encoding);
        return bufferToWrite.length;
    }
    parseExpiration(fileContent) {
        const expiration = new Date(fileContent);
        if (Number.isNaN(expiration.valueOf())) {
            throw new TypeError(this.l(`Invalid expiration: ${fileContent}`));
        }
        return expiration;
    }
    l(message) {
        return `${this._fileName}: ${message}`;
    }
}
exports.FileCachedValue = FileCachedValue;
//# sourceMappingURL=file-cached-value.js.map