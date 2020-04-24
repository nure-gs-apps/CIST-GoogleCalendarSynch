import { Stats } from 'fs';
import { ReadonlyDate } from 'readonly-date';
import { Nullable } from '../../@types';
import { asyncNoop } from '../../utils/common';
import { CacheUtilsService } from '../cache-utils.service';
import { CachedValue } from './cached-value';
import { promises as fs, constants as fsConstants } from 'graceful-fs';
import { lock } from 'proper-lockfile';

const valueOffset = new Date().toISOString().length;
const encoding = 'utf8';

export class FileCachedValue<T> extends CachedValue<T> {
  readonly needsSource = true;
  readonly needsInit = true;

  private readonly _fileName: string;
  private file: Nullable<fs.FileHandle>;
  private unlock: () => Promise<void>;

  constructor(utils: CacheUtilsService, fileName: string) {
    super(utils);
    this._fileName = fileName;
    this.unlock = asyncNoop;
    this.file = null;
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
        throw new TypeError(`${this._fileName} is expected to be a file`);
      }
      if (!fs.access(
        this._fileName,
        fsConstants.F_OK | fsConstants.R_OK | fsConstants.W_OK,
      ).then(() => true).catch(() => false)) {
        throw new Error(`Cache file ${this._fileName} is not accessible for read and write`);
      }
    }
    this.file = await fs.open(this._fileName, fileStats ? 'r+' : 'w+', 0o666);
    try {
      this.unlock = await lock(this._fileName, {
        stale: 60000,
        update: 5000,
      });
    } catch (error) {
      await this.file.close();
      this.file = null;
      throw error;
    }
    fileStats = fileStats ?? await this.file.stat();
    if (fileStats.size < valueOffset) {
      await this.writeExpiration();
    }
  }

  protected async doDispose(): Promise<void> {
    await this.file?.close();
    this.file = null;
    await this.unlock();
  }

  protected async updateExpiration(date: ReadonlyDate): Promise<void> {
    if (!this.file) {
      throw new TypeError('Invalid state, file is not loaded');
    }
    const { bytesWritten } = await this.file.write(date.toISOString(), 0);
    if (valueOffset !== bytesWritten) {
      throw new TypeError(`Bad write to file, expected ${valueOffset} bytes to be written, got ${bytesWritten}`);
    }
  }

  protected async doLoadFromCache(): Promise<[Nullable<T>, ReadonlyDate]> {
    if (!this.file) {
      throw new TypeError('Invalid state, file is not loaded');
    }
    const fileContent = await this.file.readFile(encoding);
    const expiration = parseExpiration(fileContent);
    const stringValue = fileContent.slice(valueOffset);
    if (stringValue.length === 0) {
      return [null, expiration];
    }
    return [JSON.parse(stringValue), expiration];
  }

  protected async saveValue(
    value: T | null,
    expiration: ReadonlyDate,
  ): Promise<void> {
    if (!this.file) {
      throw new TypeError('Invalid state, file is not loaded');
    }
    await this.writeExpiration(expiration);
    if (value !== null) {
      await this.file.write(
        JSON.stringify(value), valueOffset, encoding
      );
    } else {
      await this.file.truncate(valueOffset);
    }
  }

  protected hasCachedValue(): Promise<boolean> {
    return Promise.resolve(false);
  }

  protected async loadExpirationFromCache(): Promise<ReadonlyDate> {
    if (!this.file) {
      throw new TypeError('Invalid state, file is not loaded');
    }
    const buffer = Buffer.alloc(valueOffset);
    await this.file.read(buffer, 0, valueOffset, 0);
    return Promise.resolve(parseExpiration(buffer.toString(encoding)));
  }

  protected async doClearCache(): Promise<boolean> {
    if (!this.file) {
      throw new TypeError('Invalid state, file is not loaded');
    }
    if (valueOffset <= (await this.file.stat()).size) {
      return false;
    }
    await this.file.truncate(valueOffset);
    return true;
  }

  private async writeExpiration(
    expiration = this._utils.getMaxExpiration()
  ) {
    if (!this.file) {
      throw new TypeError('Invalid state, file is not loaded');
    }
    await this.file.write(expiration.toISOString(), 0, encoding);
  }
}

function parseExpiration(fileContent: string) {
  const expiration = new Date(fileContent.slice(0, valueOffset));
  if (Number.isNaN(expiration.valueOf())) {
    throw new TypeError(`Invalid expiration: ${fileContent.slice(0, valueOffset)}`);
  }
  return expiration;
}
