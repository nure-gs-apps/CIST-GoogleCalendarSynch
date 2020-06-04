import { DeepReadonly } from '../@types';
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
  bindOnExitHandler,
  unbindOnExitHandler,
} from '../services/exit-handler.service';
import { BuildingsService } from '../services/google/buildings.service';
import { TaskRunner } from '../tasks/runner';
import { EventNames, TaskStepExecutor } from '../tasks/task-step-executor';
import { getCistCachedClientTypes } from '../utils/jobs';

export async function handleSync(
  args: IEntitiesToOperateOn,
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
  container.bind<BuildingsService>(TYPES.BuildingsService)
    .to(BuildingsService);
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

  for await (const _ of taskRunner.asRunnableGenerator()) {
    if (interrupted) {
      return;
    }
  }

  unbindOnExitHandler(dispose);
}
