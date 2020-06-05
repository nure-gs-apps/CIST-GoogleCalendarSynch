import { inject, injectable } from 'inversify';
import { DeepReadonlyArray } from '../../@types';
import { ITaskDefinition, ITaskProgressBackend } from '../../@types/tasks';
import { TYPES } from '../../di/types';
import { promises as fs, writeFileSync } from 'fs';

export const encoding = 'utf8';

@injectable()
export class TaskProgressFileBackend implements ITaskProgressBackend {
  readonly fileName: string;

  constructor(@inject(TYPES.TaskProgressFileBackendFileName) fileName: string) {
    this.fileName = fileName;
  }

  save(tasks: DeepReadonlyArray<ITaskDefinition<any>>): Promise<void> {
    writeFileSync(this.fileName, JSON.stringify(tasks), {
      encoding
    }); // No other way to write in async way from signal listener
    return Promise.resolve();
  }

  async loadAndClear(): Promise<ITaskDefinition<any>[]> {
    const tasks = await this.load();
    await this.clear();
    return tasks;
  }

  async load(): Promise<ITaskDefinition<any>[]> {
    return fs.readFile(this.fileName, { encoding })
      .then(text => JSON.parse(text));
  }

  async clear() {
    return fs.unlink(this.fileName);
  }
}
