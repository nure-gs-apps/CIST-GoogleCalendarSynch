import { interfaces } from 'inversify';
import { Argv } from 'yargs';
import { DeepPartial, DeepReadonly } from '../@types';
import { IEntitiesToOperateOn } from '../@types/jobs';
import { IInfoLogger } from '../@types/logging';
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
  bindOnExitHandler, exitGracefully,
  unbindOnExitHandler,
} from '../services/exit-handler.service';
import { BuildingsService } from '../services/google/buildings.service';
import { TaskRunner } from '../tasks/runner';
import { EventNames, TaskStepExecutor } from '../tasks/task-step-executor';
import { getCistCachedClientTypes } from '../utils/jobs';
import ServiceIdentifier = interfaces.ServiceIdentifier;

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
  logger: IInfoLogger,
) {
  const container = createContainer({
    types: [
      TYPES.TaskStepExecutor,
      TYPES.TaskProgressBackend,
      ...getCistCachedClientTypes(args, config.ncgc.caching.cist.priorities)
    ],
    forceNew: true,
  });
  container.bind<CachedCistJsonClientService>(TYPES.CistJsonClient)
    .to(CachedCistJsonClientService);
  const additionalTypes: ServiceIdentifier<any>[] = [
    CachedCistJsonClientService
  ];
  if (args.auditories || args.deleteIrrelevantBuildings) {
    container.bind<BuildingsService>(TYPES.BuildingsService)
      .to(BuildingsService);
    additionalTypes.push(BuildingsService);
  }
  await getContainerAsyncInitializer(additionalTypes);

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
    const unrunTasks = taskRunner.getAllUndoneTasks(false);
    const saver = container.get<ITaskProgressBackend>(
      TYPES.TaskProgressBackend
    );
    saver.save(unrunTasks);
  };
  bindOnExitHandler(dispose);

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

  for await (const _ of taskRunner.asRunnableGenerator()) {
    if (interrupted) {
      return;
    }
  }

  logger.info('Finished synchronization');
  unbindOnExitHandler(dispose);
  exitGracefully(0);
}
