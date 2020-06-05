import { Argv } from 'yargs';
import { DeepPartial, DeepReadonly } from '../@types';
import { IEntitiesToOperateOn } from '../@types/jobs';
import { IErrorLogger, IInfoLogger, IWarnLogger } from '../@types/logging';
import {
  ITaskDefinition,
  ITaskProgressBackend,
  TaskType,
} from '../@types/tasks';
import { IFullAppConfig } from '../config/types';
import { createContainer, getContainerAsyncInitializer } from '../di/container';
import { TYPES } from '../di/types';
import { CachedCistJsonClientService } from '../services/cist/cached-cist-json-client.service';
import {
  bindOnExitHandler, disableExitTimeout, exitGracefully,
  unbindOnExitHandler,
} from '../services/exit-handler.service';
import { TaskRunner } from '../tasks/runner';
import { EventNames, TaskStepExecutor } from '../tasks/task-step-executor';
import { getCistCachedClientTypes } from '../utils/jobs';

export interface IEntitiesToRemove {
  deleteIrrelevantBuildings: boolean;
  deleteIrrelevantAuditories: boolean;
  deleteIrrelevantGroups: boolean;
  deleteIrrelevantEvents: boolean;
}

export function addEntitiesToRemoveOptions<T extends DeepPartial<IFullAppConfig> =  DeepPartial<IFullAppConfig>>(
  yargs: Argv<T>,
): Argv<T & IEntitiesToRemove> {
  const buildingsName = nameof<IEntitiesToRemove>(
    e => e.deleteIrrelevantBuildings
  );
  const auditoriesName = nameof<IEntitiesToRemove>(
    e => e.deleteIrrelevantAuditories
  );
  const groupsName = nameof<IEntitiesToRemove>(
    e => e.deleteIrrelevantGroups
  );
  const eventsName = nameof<IEntitiesToRemove>(
    e => e.deleteIrrelevantEvents
  );
  return yargs
    .option(buildingsName, {
      description: 'Delete irrelevant buildings, that are not found in current CIST Auditories response',
      type: 'boolean'
    })
    .option(auditoriesName, {
      description: 'Delete irrelevant auditories, that are not found in current CIST Auditories response',
      type: 'boolean'
    })
    .option(groupsName, {
      description: 'Delete irrelevant groups, that are not found in current CIST Groups response',
      type: 'boolean'
    })
    .option(eventsName, {
      description: 'Delete irrelevant events, that are not found in current CIST Events responses',
      type: 'boolean'
    }) as any;
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
  const taskRunner = new TaskRunner(executor);
  executor.on(EventNames.NewTask, (task: ITaskDefinition<any>) => {
    taskRunner.enqueueTask(task);
  });
  let interrupted = false;
  const dispose = async () => {
    disableExitTimeout();
    interrupted = true;
    logger.info('Waiting for current task step to finish...');
    await taskRunner.runningPromise;
    taskRunner.enqueueAllTwiceFailedTasksAndClear();
    const undoneTasks = taskRunner.getAllUndoneTasks(false);
    const progressBackend = container.get<ITaskProgressBackend>(
      TYPES.TaskProgressBackend
    );
    await progressBackend.save(undoneTasks);
  };
  bindOnExitHandler(dispose);

  taskRunner.enqueueTasks(false, ...tasks);
  for await (const _ of taskRunner.asRunnableGenerator()) {
    if (interrupted) {
      break;
    }
  }
  if (taskRunner.hasFailedTasks()) {
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
  logger.info('Finished synchronization');
  unbindOnExitHandler(dispose);
  exitGracefully(0);
}
