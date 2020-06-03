import { inject } from 'inversify';
import { DeepReadonlyArray } from '../../@types';
import { ITaskDefinition, ITaskProgressBackend } from '../../@types/tasks';
import { TYPES } from '../../di/types';
import { promises as fs } from 'fs';

export const encoding = 'utf8';

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

  load(): Promise<ITaskDefinition<any>[]> {
    return fs.readFile(this.fileName, { encoding })
      .then(text => JSON.parse(text));
  }
}
