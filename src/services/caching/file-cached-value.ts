import { ReadonlyDate } from 'readonly-date';
import { Nullable } from '../../@types';
import { asyncNoop } from '../../utils/common';
import { CacheUtilsService } from '../cache-utils.service';
import { CachedValue } from './cached-value';
import { promises as fs, constants as fsConstants } from 'graceful-fs';
import { lock } from 'proper-lockfile';

const expirationSeparatorChar = '$';
const separatorPosition = new Date().toISOString().length;
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
    if (!await this.canAccessFile()) {
      throw new Error(`Cache file ${this._fileName} is not accessible for read and write`);
    }
    this.unlock = await lock(this._fileName, {
      stale: 60000,
      update: 5000,
    });
    this.file = await fs.open(this._fileName, 'r+', 666);
    if ((await this.file.stat()).size < separatorPosition) {
      await this.writeExpiration();
    }
  }

  protected async doDispose(): Promise<void> {
    await this.file?.close();
    this.file = null;
    await this.unlock();
  }

  protected async canAccessFile() {
    return fs.access(
      this._fileName,
      fsConstants.F_OK | fsConstants.R_OK | fsConstants.W_OK
    ).catch(() => true);
  }

  protected async updateExpiration(date: ReadonlyDate): Promise<void> {
    if (!this.file) {
      throw new TypeError('Invalid state, file is not loaded');
    }
    const { bytesWritten } = await this.file.write(date.toISOString(), 0);
    if (separatorPosition !== bytesWritten) {
      throw new TypeError(`Bad write to file, expected ${separatorPosition} bytes to be written, got ${bytesWritten}`);
    }
  }

  protected async doLoadFromCache(): Promise<[Nullable<T>, ReadonlyDate]> {
    if (!this.file) {
      throw new TypeError('Invalid state, file is not loaded');
    }
    const fileContent = await this.file.readFile(encoding);
    const expiration = new Date(fileContent.slice(0, separatorPosition));
    if (Number.isNaN(expiration.valueOf())) {
      throw new TypeError(`Invalid expiration: ${fileContent.slice(0, separatorPosition)}`);
    }
    if (fileContent[separatorPosition] !== expirationSeparatorChar) {
      throw new TypeError(`Invalid expiration separator found. Expected ${expirationSeparatorChar}, found ${fileContent[separatorPosition]}`);
    }
    const stringValue = fileContent.slice(separatorPosition + 1);
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
    await this.file.write(expirationSeparatorChar, separatorPosition, encoding);
    if (value !== null) {
      await this.file.write(
        JSON.stringify(value), separatorPosition + 1, encoding
      );
    }
  }

  protected async doClearCache(): Promise<void> {
    if (!this.file) {
      throw new TypeError('Invalid state, file is not loaded');
    }
    await this.file.truncate(separatorPosition + 1);
  }

  private async writeExpiration(
    expiration = this._utils.getMaxExpiration()
  ) {
    if (!this.file) {
      throw new TypeError('Invalid state, file is not loaded');
    }
    await this.file.write(expiration.toISOString(), 0, encoding);
    await this.file.write(expirationSeparatorChar, separatorPosition, encoding);
  }
}
