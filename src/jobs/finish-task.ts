import { interfaces } from 'inversify';
import { DeepReadonly, DeepReadonlyArray } from '../@types';
import { IErrorLogger, IInfoLogger, IWarnLogger } from '../@types/logging';
import {
  ITaskDefinition,
  ITaskProgressBackend,
  TaskType,
} from '../@types/tasks';
import { IFullAppConfig, parseTasksTimeout } from '../config/types';
import {
  addTypesToContainer,
  createContainer,
  disposeContainer,
  getContainerAsyncInitializer, IAddContainerTypes,
} from '../di/container';
import { TYPES } from '../di/types';
import {
  CachedCistJsonClientService,
  getSharedCachedCistJsonClientInstance,
} from '../services/cist/cached-cist-json-client.service';
import {
  DeadlineService,
  DeadlineServiceEventNames,
} from '../services/deadline.service';
import {
  bindOnExitHandler, disableExitTimeout, enableExitTimeout, exitGracefully,
  unbindOnExitHandler,
} from '../services/exit-handler.service';
import { TaskProgressFileBackend } from '../tasks/progress/file';
import { TaskRunner } from '../tasks/runner';
import { TaskStepExecutorEventNames, TaskStepExecutor } from '../tasks/task-step-executor';
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
  const tasks = await (
    progressBackend instanceof TaskProgressFileBackend
    ? progressBackend.load()
    : progressBackend.loadAndClear()
  );

  addTypesToContainer(getRequiredServicesConfig(tasks));
  container.bind<CachedCistJsonClientService>(TYPES.CistJsonClient)
    .toDynamicValue(getSharedCachedCistJsonClientInstance);
  await getContainerAsyncInitializer();

  const executor = container.get<TaskStepExecutor>(TYPES.TaskStepExecutor);
  const taskRunner = new TaskRunner(executor, config.ncgc.tasks.concurrency);
  executor.on(
    TaskStepExecutorEventNames.NewTask,
    (task: ITaskDefinition<any>) => {
      taskRunner.enqueueTask(task);
    },
  );
  let interrupted = false;
  const dispose = async () => {
    if (taskRunner.hasAnyTasks()) {
      disableExitTimeout();
      logger.info(
        'Waiting for current task step to finish and saving interrupted tasks...');
      await saveInterruptedTasks();
      enableExitTimeout();
    }
  };
  bindOnExitHandler(dispose);
  const deadlineService = new DeadlineService(parseTasksTimeout(config.ncgc));
  deadlineService.on(DeadlineServiceEventNames.Deadline, () => {
    logger.info('Time has run out, saving interrupted tasks...');
    saveInterruptedTasks().catch(error => logger.error(
      'Error while saving interrupted task',
      error,
    ));
  });

  taskRunner.enqueueTasks(false, ...tasks);
  logger.info('Running tasks...');
  for await (const _ of taskRunner.asRunnableGenerator()) {
    if (interrupted) {
      break;
    }
  }
  let deleteProgressFile = true;
  if (!interrupted && taskRunner.hasFailedTasks()) {
    logger.warn(`${taskRunner.getFailedStepCount()} failed task steps found. Rerunning...`);
    for await (const _ of taskRunner.asFailedRunnableGenerator()) {
      if (interrupted) {
        break;
      }
    }
    if (!interrupted && taskRunner.hasTwiceFailedTasks()) {
      logger.error(`Rerunning ${taskRunner.getTwiceFailedStepCount()} failed task steps failed. Saving these steps...`);
      await progressBackend.save(taskRunner.getTwiceFailedTasks(false));
      deleteProgressFile = false;
    }
  }
  if (
    progressBackend instanceof TaskProgressFileBackend
    && !interrupted
    && deleteProgressFile
  ) {
    await progressBackend.clear();
  }

  logger.info(
    !interrupted
    ? 'Finished job'
    : 'Job execution was interrupted'
  );
  unbindOnExitHandler(dispose);
  exitGracefully(0);

  async function saveInterruptedTasks() {
    interrupted = true;
    await taskRunner.runningPromise;
    taskRunner.enqueueAllTwiceFailedTasksAndClear();
    const undoneTasks = taskRunner.getAllUndoneTasks(false);
    await progressBackend.save(undoneTasks);
  }
}

function getRequiredServicesConfig(
  tasks: DeepReadonlyArray<ITaskDefinition<any>>,
): Partial<IAddContainerTypes> {
  const types = [
    CachedCistJsonClientService,
    TYPES.TaskStepExecutor
  ] as ServiceIdentifier<any>[];
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
