import { inject, injectable } from 'inversify';
import { DeepReadonly } from '../../../@types';
import { IEventsTaskContextStorage } from '../../../@types/google';
import { TYPES } from '../../../di/types';
import { constants, promises as fs, writeFileSync } from 'fs';
import * as path from 'path';
import { fAccess } from '../../../utils/fs';
import {
  eventsTaskContextFromSerializable,
  eventsTaskContextToSerializable,
} from '../../../utils/google';
import { IEventsTaskContextBase } from '../events.service';

export const encoding = 'utf8';

@injectable()
export class FileEventsTaskContextStorage implements IEventsTaskContextStorage {
  readonly fileName: string;

  constructor(@inject(
    TYPES.GoogleCalendarEventsTaskContextStorageFileName
  ) fileName: string) {
    this.fileName = fileName;
  }

  exists() {
    return fAccess(
      this.fileName,
      constants.F_OK | constants.R_OK | constants.W_OK,
    );
  }

  load() {
    return fs.readFile(this.fileName, { encoding })
      .then(text => eventsTaskContextFromSerializable(JSON.parse(text)));
  }

  async save(context: DeepReadonly<IEventsTaskContextBase>): Promise<void> {
    await fs.mkdir(path.dirname(this.fileName), { recursive: true });
    writeFileSync(
      this.fileName,
      JSON.stringify(eventsTaskContextToSerializable(context)),
      { encoding }
    );
  }

  clear() {
    return fs.unlink(this.fileName);
  }
}
