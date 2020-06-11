import { Container, interfaces } from 'inversify';
import { DeepReadonly, DeepReadonlyArray, Nullable, Optional } from '../@types';
import { IEntitiesToOperateOn } from '../@types/jobs';
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
  getContainerAsyncInitializer,
  ICreateContainerOptions,
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
  bindOnExitHandler,
  disableExitTimeout,
  enableExitTimeout,
  exitGracefully,
  unbindOnExitHandler,
} from '../services/exit-handler.service';
import { TaskProgressFileBackend } from '../tasks/progress/file';
import { TaskRunner } from '../tasks/runner';
import {
  TaskStepExecutor,
  TaskStepExecutorEventNames,
} from '../tasks/task-step-executor';
import {
  getCistCachedClientTypes,
  getCistCachedClientTypesForArgs,
} from '../utils/jobs';
import ServiceIdentifier = interfaces.ServiceIdentifier;

export interface IEntitiesToRemove {
  deleteIrrelevantAuditories: boolean;
  deleteIrrelevantGroups: boolean;
  deleteIrrelevantEvents: boolean;
}

export class RunTasksJob {
  protected readonly _config: DeepReadonly<IFullAppConfig>;
  protected readonly _logger: IInfoLogger & IWarnLogger & IErrorLogger;
  protected readonly _args: Optional<IEntitiesToOperateOn & IEntitiesToRemove>;

  protected _container: Nullable<Container>;
  protected _progressBackend: Nullable<ITaskProgressBackend>;
  protected _interrupted: boolean;
  protected _taskRunner: Nullable<TaskRunner>;

  constructor(
    config: DeepReadonly<IFullAppConfig>,
    logger: IInfoLogger & IWarnLogger & IErrorLogger,
    args?: IEntitiesToOperateOn & IEntitiesToRemove,
  ) {
    this._config = config;
    this._logger = logger;
    this._args = args;

    this._container = null;
    this._progressBackend = null;
    this._interrupted = false;
    this._taskRunner = null;
  }

  async handle() {
    let tasks: ITaskDefinition<any>[];
    if (this._args) {
      tasks = getTasksFromArgs(this._args);
      if (tasks.length === 0) {
        throw new TypeError('No tasks found. Please, specify either synchronization or removal.');
      }

      const types = this.getRequiredServicesFromTasks(tasks);
      types.push(TYPES.TaskProgressBackend);
      this._container = createContainer(this.getContainerConfig(types));
    } else {
      this._container = createContainer(
        this.getContainerConfig([TYPES.TaskProgressBackend])
      );
      bindOnExitHandler(disposeContainer);
      await getContainerAsyncInitializer();
      this._progressBackend = this._container.get<ITaskProgressBackend>(
        TYPES.TaskProgressBackend
      );
      tasks = await (
        this._progressBackend instanceof TaskProgressFileBackend
          ? this._progressBackend.load()
          : this._progressBackend.loadAndClear()
      );

      addTypesToContainer({
        types: this.getRequiredServicesFromTasks(tasks)
      });
    }
    this._container.bind<CachedCistJsonClientService>(TYPES.CistJsonClient)
      .toDynamicValue(getSharedCachedCistJsonClientInstance);
    let init: Nullable<Promise<any>> = getContainerAsyncInitializer().finally(
      () => init = null
    );
    await init;

    const executor = this._container.get<TaskStepExecutor>(
      TYPES.TaskStepExecutor
    );
    this._taskRunner = new TaskRunner(
      executor,
      this._config.ncgc.tasks.concurrency,
    );
    executor.on(
      TaskStepExecutorEventNames.NewTask,
      (task: ITaskDefinition<any>) => {
        if (!this._taskRunner) {
          throw new TypeError('Unknown state');
        }
        this._taskRunner.enqueueTask(task);
        addTypesToContainer({
          types: this.getRequiredServicesFromTasks([task])
        });
        init = getContainerAsyncInitializer();
      },
    );
    const dispose = async () => {
      disableExitTimeout();
      this._logger.info('Waiting for current task step to finish...');
      await this.saveInterruptedTasks();
      enableExitTimeout();
    };

    bindOnExitHandler(dispose);
    const deadlineService = new DeadlineService(parseTasksTimeout(
      this._config.ncgc
    ));
    deadlineService.on(DeadlineServiceEventNames.Deadline, () => {
      this._logger.info('Time has run out, saving interrupted tasks...');
      this.saveInterruptedTasks().catch(error => this._logger.error(
        'Error while saving interrupted task',
        error,
      ));
    });

    this._taskRunner.enqueueTasks(false, ...tasks);
    this._logger.info(
      this._args
      ? 'Running synchronization tasks...'
      : 'Running tasks...'
    );
    for await (const _ of this._taskRunner.asRunnableGenerator()) {
      if (this._interrupted) {
        break;
      }
      if (init) {
        await init;
      }
    }
    let deleteProgressFile = true;
    if (!this._interrupted && this._taskRunner.hasFailedTasks()) {
      this._logger.warn(`Totally ${this._taskRunner.getFailedStepCount()} failed task steps found. Rerunning...`);
      for await (const _ of this._taskRunner.asFailedRunnableGenerator()) {
        if (this._interrupted) {
          break;
        }
        if (init) {
          await init;
        }
      }
      if (!this._interrupted && this._taskRunner.hasTwiceFailedTasks()) {
        this._logger.error(`Rerunning ${this._taskRunner.getTwiceFailedStepCount()} failed task steps failed. Saving these steps...`);
        if (!this._taskRunner) {
          throw new TypeError('Unknown state');
        }
        await this.getProgressBackend()
          .save(this._taskRunner.getTwiceFailedTasks(false));
        deleteProgressFile = false;
      }
    }
    if (
      !this._args
      && this._progressBackend instanceof TaskProgressFileBackend
      && !this._interrupted
      && deleteProgressFile
    ) {
      await this._progressBackend.clear();
    }

    this._logger.info(
      !this._interrupted
        ? (this._args ? 'Finished synchronization' : 'Finished job')
        : (
          this._args
            ? 'Synchronization was interrupted'
            : 'Job execution was interrupted'
        )
    );
    unbindOnExitHandler(dispose);
    exitGracefully(0);
  }

  protected async saveInterruptedTasks() {
    if (!this._taskRunner || !this._container) {
      throw new TypeError('Unknown state');
    }
    this._interrupted = true;
    await this._taskRunner.runningPromise;
    if (this._taskRunner.hasAnyTasks()) {
      this._logger.info('Saving interrupted tasks...');
      this._taskRunner.enqueueAllTwiceFailedTasksAndClear();
      const undoneTasks = this._taskRunner.getAllUndoneTasks(false);
      await this.getProgressBackend().save(undoneTasks);
    } else {
      this._logger.info('All tasks were finished!');
      if (!this._args) {
        await this.clearTaskProgressBackendIfCan();
      }
    }
  }

  protected async clearTaskProgressBackendIfCan() {
    if (this._progressBackend instanceof TaskProgressFileBackend) {
      await this._progressBackend.clear();
    }
  }

  protected getProgressBackend() {
    if (!this._progressBackend) {
      if (!this._container) {
        throw new TypeError('Unknown state');
      }
      this._progressBackend = this._container.get<ITaskProgressBackend>(
        TYPES.TaskProgressBackend
      );
    }
    return this._progressBackend;
  }

  protected getContainerConfig(
    types: ReadonlyArray<ServiceIdentifier<any>>,
  ): Partial<ICreateContainerOptions> {
    return {
      types,
      forceNew: true
    };
  }

  protected getRequiredServicesFromTasks(
    tasks: DeepReadonlyArray<ITaskDefinition<any>>,
  ): ServiceIdentifier<any>[] {
    const types = [TYPES.TaskStepExecutor] as ServiceIdentifier<any>[];
    if (tasks.some(({ taskType }) => (
      taskType === TaskType.DeferredDeleteIrrelevantBuildings
      // || taskType === TaskType.DeferredEnsureBuildings
      || taskType === TaskType.EnsureBuildings
      || taskType === TaskType.DeleteIrrelevantBuildings
    ))) {
      types.push(TYPES.BuildingsService);
    }

    if (tasks.some(({ taskType }) => (
      taskType === TaskType.DeferredDeleteIrrelevantRooms
      // || taskType === TaskType.DeferredEnsureRooms
      || taskType === TaskType.EnsureRooms
      || taskType === TaskType.DeleteIrrelevantRooms
    ))) {
      types.push(TYPES.RoomsService);
    }

    if (tasks.some(({ taskType }) => (
      taskType === TaskType.DeferredDeleteIrrelevantGroups
      // || taskType === TaskType.DeferredEnsureGroups
      || taskType === TaskType.EnsureGroups
      || taskType === TaskType.DeleteIrrelevantGroups
    ))) {
      types.push(TYPES.GroupsService);
    }

    if (tasks.some(({ taskType }) => (
      taskType === TaskType.DeferredEnsureBuildings
      || taskType === TaskType.DeferredDeleteIrrelevantBuildings
      || taskType === TaskType.EnsureBuildings
      // || taskType === TaskType.DeleteIrrelevantBuildings
      || taskType === TaskType.DeferredEnsureRooms
      || taskType === TaskType.DeferredDeleteIrrelevantRooms
      || taskType === TaskType.EnsureRooms
      // || taskType === TaskType.DeleteIrrelevantRooms
      || taskType === TaskType.DeferredEnsureGroups
      || taskType === TaskType.DeferredDeleteIrrelevantGroups
      || taskType === TaskType.EnsureGroups
      // || taskType === TaskType.DeleteIrrelevantGroups
    ))) {
      types.push(...(
        this._args
          ? getCistCachedClientTypesForArgs(
            this._args,
            this._config.ncgc.caching.cist.priorities,
          )
          : getCistCachedClientTypes(
            this._config.ncgc.caching.cist.priorities
          )
      ));
    }
    return types;
  }
}

function getTasksFromArgs(
  args: IEntitiesToOperateOn & IEntitiesToRemove,
): ITaskDefinition<any>[] {
  const tasks: ITaskDefinition<any>[] = [];
  if (args.auditories) {
    tasks.push({
      taskType: TaskType.DeferredEnsureBuildings
    }, {
      taskType: TaskType.DeferredEnsureRooms
    });
  }
  if (args.deleteIrrelevantAuditories) {
    tasks.push({
      taskType: TaskType.DeferredDeleteIrrelevantRooms
    }, {
      taskType: TaskType.DeferredDeleteIrrelevantBuildings
    });
  }
  if (args.groups) {
    tasks.push({
      taskType: TaskType.DeferredEnsureGroups
    });
  }
  if (args.deleteIrrelevantGroups) {
    tasks.push({
      taskType: TaskType.DeferredDeleteIrrelevantGroups
    });
  }
  return tasks;
}
