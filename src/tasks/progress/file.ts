import { inject, injectable } from 'inversify';
import { DeepReadonlyArray } from '../../@types';
import { ITaskDefinition, ITaskProgressBackend } from '../../@types/tasks';
import { TYPES } from '../../di/types';
import { promises as fs } from 'fs';

export const encoding = 'utf8';

@injectable()
export class TaskProgressFileBackend implements ITaskProgressBackend {
  readonly fileName: string;

  constructor(@inject(TYPES.TaskProgressFileBackendFileName) fileName: string) {
    this.fileName = fileName;
  }

  save(tasks: DeepReadonlyArray<ITaskDefinition<any>>): Promise<void> {
    return fs.writeFile(this.fileName, JSON.stringify(tasks), {
      encoding
    });
  }

  async loadAndClear(): Promise<ITaskDefinition<any>[]> {
    const tasks = await fs.readFile(this.fileName, { encoding })
      .then(text => JSON.parse(text));
    await fs.unlink(this.fileName);
    return tasks;
  }
}
