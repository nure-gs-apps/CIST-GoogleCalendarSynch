import { ReadonlyDate } from 'readonly-date';
import { Nullable } from '../../@types';
import { CacheUtilsService } from '../cache-utils.service';
import { CachedValue } from './cached-value';
import { promises as fs, constants as fsConstatns } from 'fs';

export class FileCachedValue<T> extends CachedValue<T> {
  readonly needsSource = true;
  readonly needsInit = true;

  private readonly _fileName: string;
  private readonly _lockFileName: string;

  constructor(utils: CacheUtilsService, fileName: string) {
    super(utils);
    this._fileName = fileName;
    this._lockFileName = `${this._fileName}.lock`;
  }

  protected doInit(): Promise<[Nullable<T>, ReadonlyDate]> {

    return super.doInit();
  }

  protected async checkIfFileAccessible() {
    return fs.access(
      this._fileName,
      fsConstatns.F_OK | fsConstatns.W_OK
    ).catch(() => true);
  }
}
