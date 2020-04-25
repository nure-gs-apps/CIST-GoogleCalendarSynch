import { Stats } from 'fs';
import { ReadonlyDate } from 'readonly-date';
import { Nullable } from '../../@types';
import { asyncNoop } from '../../utils/common';
import {
  fCutOut,
  fReadFile,
  fReadUntil,
  fShiftForward,
  fSize,
} from '../../utils/fs';
import { CacheUtilsService } from '../cache-utils.service';
import { CachedValue } from './cached-value';
import { promises as fs, constants as fsConstants } from 'graceful-fs';
import { lock } from 'proper-lockfile';

const encoding = 'utf8';
const expirationSeparator = '\n';
const expirationSeparatorBuffer = Buffer.from(expirationSeparator, encoding);
const expirationBufferSize = Buffer.from(
  new Date().toISOString(), encoding
).length + expirationSeparatorBuffer.length;

export class FileCachedValue<T> extends CachedValue<T> {
  readonly isDestroyable = true;
  readonly needsSource = true;
  readonly needsInit = true;

  get [Symbol.toStringTag]() {
    return `${FileCachedValue.name}[${this._fileName}]`;
  }

  private readonly _fileName: string;
  private _file: Nullable<fs.FileHandle>;
  private unlock: () => Promise<void>;

  constructor(utils: CacheUtilsService, fileName: string) {
    super(utils);
    this._fileName = fileName;
    this.unlock = asyncNoop;
    this._file = null;
  }

  protected async doInit(): Promise<void> {
    let fileStats: Nullable<Stats> = null;
    try {
      fileStats = await fs.stat(this._fileName);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
    if (fileStats) {
      if (!fileStats.isFile()) {
        throw new TypeError(this.t('is expected to be a file'));
      }
      if (!fs.access(
        this._fileName,
        fsConstants.F_OK | fsConstants.R_OK | fsConstants.W_OK,
      ).then(() => true).catch(() => false)) {
        throw new Error(this.t(`Cache file ${this._fileName} is not accessible for read and write`));
      }
    }
    this._file = await fs.open(this._fileName, fileStats ? 'r+' : 'w+', 0o666);
    try {
      this.unlock = await lock(this._fileName, {
        stale: 60000,
        update: 5000,
      });
    } catch (error) {
      await this.doDispose();
      throw error;
    }
    fileStats = fileStats ?? await this._file.stat();
    if (fileStats.size < expirationBufferSize) {
      await this.writeExpiration();
    }
  }

  protected async doDispose(): Promise<void> {
    await this._file?.close();
    this._file = null;
    await this.unlock();
  }

  protected async doDestroy() {
    await fs.unlink(this._fileName);
  }

  protected async updateExpiration(date: ReadonlyDate): Promise<void> {
    if (!this._file) {
      throw new TypeError(this.t('Invalid state, file is not loaded'));
    }
    await this.writeExpiration(date);
  }

  protected async doLoadFromCache(): Promise<[Nullable<T>, ReadonlyDate]> {
    if (!this._file) {
      throw new TypeError(this.t('Invalid state, file is not loaded'));
    }
    // const { contents, found } = await fReadUntil(this._file, expirationSeparatorBuffer, 0);
    // const b = contents.toString(encoding);
    // console.log(b, found);
    const fileContents = await fReadFile(this._file, encoding);
    const separatorIndex = fileContents.indexOf(expirationSeparator);
    if (separatorIndex < 0) {
      throw new TypeError(this.t('Invalid format, no expiration separator'));
    }
    const expiration = this.parseExpiration(fileContents.slice(
      0,
      separatorIndex,
    ));
    const stringValue = fileContents.slice(
      separatorIndex + expirationSeparatorBuffer.length
    );
    if (stringValue.length === 0) {
      return [null, expiration];
    }
    return [JSON.parse(stringValue), expiration];
  }

  protected async saveValue(
    value: T | null,
    expiration: ReadonlyDate,
  ): Promise<void> {
    if (!this._file) {
      throw new TypeError(this.t('Invalid state, file is not loaded'));
    }
    const bytesWritten = await this.writeExpiration(expiration, false);
    if (value !== null) {
      await this._file.write(
        JSON.stringify(value), bytesWritten, encoding
      );
    } else {
      await this._file.truncate(bytesWritten);
    }
  }

  protected hasCachedValue(): Promise<boolean> {
    return Promise.resolve(false);
  }

  protected async loadExpirationFromCache(): Promise<ReadonlyDate> {
    if (!this._file) {
      throw new TypeError(this.t('Invalid state, file is not loaded'));
    }
    const { contents } = await fReadUntil(
      this._file,
      expirationSeparatorBuffer,
      0,
      expirationBufferSize,
    );
    return Promise.resolve(this.parseExpiration(contents.toString(encoding)));
  }

  protected async doClearCache(): Promise<boolean> {
    if (!this._file) {
      throw new TypeError(this.t('Invalid state, file is not loaded'));
    }
    if (expirationBufferSize <= await fSize(this._file)) {
      return false;
    }
    await this._file.truncate((
      await fReadUntil(this._file, expirationSeparatorBuffer)
    ).contents.length + expirationSeparatorBuffer.length);
    return true;
  }

  private async writeExpiration(
    expiration = this._utils.getMaxExpiration(),
    preserveContents = true
  ) {
    if (!this._file) {
      throw new TypeError(this.t('Invalid state, file is not loaded'));
    }
    const expirationBuffer = Buffer.from(expiration.toISOString(), encoding);
    if (preserveContents) {
      const { contents, found } = await fReadUntil(
        this._file,
        expirationSeparatorBuffer,
        0,
        expirationBufferSize,
      );
      if (found) {
        if (contents.length > expirationBuffer.length) {
          const cutOutLength = expirationBuffer.length - contents.length;
          await fCutOut(
            this._file,
            contents.length + expirationSeparatorBuffer.length - cutOutLength,
            cutOutLength,
            await fSize(this._file),
          );
        } else if (contents.length < expirationBuffer.length) {
          const offset = expirationBuffer.length - contents.length;
          await fShiftForward(
            this._file,
            contents.length + expirationSeparatorBuffer.length,
            offset,
            await fSize(this._file),
          );
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

  parseExpiration(fileContent: string) {
    const expiration = new Date(fileContent);
    if (Number.isNaN(expiration.valueOf())) {
      throw new TypeError(this.t(`Invalid expiration: ${fileContent}`));
    }
    return expiration;
  }
}
