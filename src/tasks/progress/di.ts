import { interfaces } from 'inversify';
import {
  defaultTaskProgressBackend, ITaskProgressBackend, TaskProgressBackend,
  taskProgressBackendValues,
} from '../../@types/tasks';
import { TYPES } from '../../di/types';
import { TaskProgressFileBackend } from './file';

export function getTaskProgressBackend(
  context: interfaces.Context
): ITaskProgressBackend {
  let type = context.container.get<TaskProgressBackend>(
    TYPES.TaskProgressFileBackendType
  );
  if (!taskProgressBackendValues.includes(type)) {
    type = defaultTaskProgressBackend;
  }
  switch (type) {
    case TaskProgressBackend.File:
      return context.container.get<TaskProgressFileBackend>(
        TYPES.TaskProgressFileBackend
      );
  }
}
