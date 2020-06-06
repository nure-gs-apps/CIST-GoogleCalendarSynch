import { DeepReadonly } from '../@types';
import { IEntitiesToOperateOn } from '../@types/jobs';
import { IErrorLogger, IInfoLogger, IWarnLogger } from '../@types/logging';
import {
  ITaskDefinition,
  ITaskProgressBackend,
  TaskType,
} from '../@types/tasks';
import { IFullAppConfig, parseTasksTimeout } from '../config/types';
import { createContainer, getContainerAsyncInitializer } from '../di/container';
import { TYPES } from '../di/types';
import { CachedCistJsonClientService } from '../services/cist/cached-cist-json-client.service';
import {
  DeadlineService,
  DeadlineServiceEventNames,
} from '../services/deadline.service';
import {
  bindOnExitHandler,
  disableExitTimeout, enableExitTimeout,
  exitGracefully,
  unbindOnExitHandler,
} from '../services/exit-handler.service';
import { TaskRunner } from '../tasks/runner';
import { TaskStepExecutorEventNames, TaskStepExecutor } from '../tasks/task-step-executor';
import { getCistCachedClientTypes } from '../utils/jobs';

export interface IEntitiesToRemove {
  deleteIrrelevantBuildings: boolean;
  deleteIrrelevantAuditories: boolean;
  deleteIrrelevantGroups: boolean;
  deleteIrrelevantEvents: boolean;
}

export async function handleSync(
  args: IEntitiesToOperateOn & IEntitiesToRemove,
  config: DeepReadonly<IFullAppConfig>,
  logger: IInfoLogger & IWarnLogger & IErrorLogger,
) {
  const tasks: ITaskDefinition<any>[] = [];
  if (args.auditories) {
    tasks.push({
      taskType: TaskType.DeferredEnsureBuildings
    });
  }
  if (args.deleteIrrelevantAuditories) {
    tasks.push({
      taskType: TaskType.DeferredDeleteIrrelevantBuildings
    });
  }
  if (tasks.length === 0) {
    throw new TypeError('No tasks found. Please, specify either synchronization or removal.');
  }

  const types = [
    TYPES.TaskStepExecutor,
    TYPES.TaskProgressBackend,
    ...getCistCachedClientTypes(args, config.ncgc.caching.cist.priorities),
    CachedCistJsonClientService,
  ];
  if (args.auditories || args.deleteIrrelevantBuildings) {
    types.push(TYPES.BuildingsService);
  }
  const container = createContainer({
    types,
    forceNew: true,
  });
  container.bind<CachedCistJsonClientService>(TYPES.CistJsonClient)
    .to(CachedCistJsonClientService);
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
    disableExitTimeout();
    logger.info('Waiting for current task step to finish and saving interrupted tasks...');
    await saveInterruptedTasks();
    enableExitTimeout();
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
  logger.info('Running synchronization tasks...');
  for await (const _ of taskRunner.asRunnableGenerator()) {
    if (interrupted) {
      break;
    }
  }
  if (!interrupted && taskRunner.hasFailedTasks()) {
    logger.warn(`Totally ${taskRunner.getFailedStepCount()} task steps failed. Rerunning...`);
    for await (const _ of taskRunner.asFailedRunnableGenerator()) {
      if (interrupted) {
        break;
      }
    }
    if (taskRunner.hasTwiceFailedTasks()) {
      logger.error(`Rerunning ${taskRunner.getTwiceFailedStepCount()} failed task steps failed. Saving these steps...`);
      const progressBackend = container.get<ITaskProgressBackend>(
        TYPES.TaskProgressBackend
      );
      await progressBackend.save(taskRunner.getTwiceFailedTasks(false));
    }
  }
  logger.info(
    !interrupted
      ? 'Finished synchronization'
      : 'Synchronization was interrupted'
  );
  unbindOnExitHandler(dispose);
  exitGracefully(0);

  async function saveInterruptedTasks() {
    interrupted = true;
    await taskRunner.runningPromise;
    taskRunner.enqueueAllTwiceFailedTasksAndClear();
    const undoneTasks = taskRunner.getAllUndoneTasks(false);
    const progressBackend = container.get<ITaskProgressBackend>(
      TYPES.TaskProgressBackend
    );
    await progressBackend.save(undoneTasks);
  }
}
