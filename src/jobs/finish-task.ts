import { interfaces } from 'inversify';
import { DeepReadonly, DeepReadonlyArray } from '../@types';
import { IErrorLogger, IInfoLogger, IWarnLogger } from '../@types/logging';
import {
  ITaskDefinition,
  ITaskProgressBackend,
  TaskType,
} from '../@types/tasks';
import { IFullAppConfig } from '../config/types';
import {
  addTypesToContainer,
  createContainer,
  disposeContainer,
  getContainerAsyncInitializer, IAddContainerTypes,
} from '../di/container';
import { TYPES } from '../di/types';
import { CachedCistJsonClientService } from '../services/cist/cached-cist-json-client.service';
import {
  bindOnExitHandler, exitGracefully,
  unbindOnExitHandler,
} from '../services/exit-handler.service';
import { TaskRunner } from '../tasks/runner';
import { EventNames, TaskStepExecutor } from '../tasks/task-step-executor';
import ServiceIdentifier = interfaces.ServiceIdentifier;

export async function handleFinishTask(
  config: DeepReadonly<IFullAppConfig>,
  logger: IInfoLogger & IWarnLogger & IErrorLogger,
) {
  const container = createContainer({
    types: [TYPES.TaskProgressBackend],
    forceNew: true,
  });
  bindOnExitHandler(disposeContainer);
  await getContainerAsyncInitializer();
  const progressBackend = container.get<ITaskProgressBackend>(
    TYPES.TaskProgressBackend
  );
  const tasks = await progressBackend.loadAndClear();

  addTypesToContainer(getRequiredServicesConfig(tasks));
  container.bind<CachedCistJsonClientService>(TYPES.CistJsonClient)
    .to(CachedCistJsonClientService);
  await getContainerAsyncInitializer();

  const executor = container.get<TaskStepExecutor>(TYPES.TaskStepExecutor);
  const taskRunner = new TaskRunner(executor);
  executor.on(EventNames.NewTask, (task: ITaskDefinition<any>) => {
    taskRunner.enqueueTask(task);
  });
  let interrupted = false;
  const dispose = async () => {
    interrupted = true;
    await taskRunner.runningPromise;
    taskRunner.enqueueAllTwiceFailedTasksAndClear();
    const undoneTasks = taskRunner.getAllUndoneTasks(false);
    await progressBackend.save(undoneTasks);
  };
  bindOnExitHandler(dispose);

  taskRunner.enqueueTasks(false, ...tasks);
  logger.info('Running tasks...');
  for await (const _ of taskRunner.asRunnableGenerator()) {
    if (interrupted) {
      break;
    }
  }
  if (taskRunner.hasFailedTasks()) {
    logger.warn(`${taskRunner.getFailedStepCount()} failed task steps found. Rerunning...`);
    for await (const _ of taskRunner.asFailedRunnableGenerator()) {
      if (interrupted) {
        break;
      }
    }
    if (taskRunner.hasTwiceFailedTasks()) {
      logger.error(`Rerunning ${taskRunner.getTwiceFailedStepCount()} failed task steps failed. Saving these steps...`);
      await progressBackend.save(taskRunner.getTwiceFailedTasks(false));
    }
  }

  logger.info('Finished synchronization');
  unbindOnExitHandler(dispose);
  exitGracefully(0);
}

function getRequiredServicesConfig(
  tasks: DeepReadonlyArray<ITaskDefinition<any>>,
): Partial<IAddContainerTypes> {
  const types = [] as ServiceIdentifier<any>[];
  if (tasks.some(({ taskType }) => (
    taskType === TaskType.DeferredEnsureBuildings
    || taskType === TaskType.DeferredDeleteIrrelevantBuildings
    || taskType === TaskType.EnsureBuildings
    || taskType === TaskType.DeleteIrrelevantBuildings
  ))) {
    types.push(TYPES.BuildingsService);
  }

  if (tasks.some(({ taskType }) => (
    taskType === TaskType.DeferredEnsureBuildings
    || taskType === TaskType.DeferredDeleteIrrelevantBuildings
  ))) {
    types.push(CachedCistJsonClientService);
  }
  return { types };
}
