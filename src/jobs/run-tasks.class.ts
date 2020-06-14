import { Container, interfaces } from 'inversify';
import { DeepReadonly, Nullable, Optional } from '../@types';
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
  getRequiredServicesFromTasks,
  TaskStepExecutor,
  TaskStepExecutorEventNames,
} from '../tasks/task-step-executor';
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

      const types = getRequiredServicesFromTasks(
        tasks,
        this._config.ncgc.caching.cist.priorities,
        {
          auditories: this._args.auditories
            || this._args.deleteIrrelevantAuditories,
          groups: this._args.groups || this._args.deleteIrrelevantGroups,
          events: this._args.deleteIrrelevantGroups ? [] : this._args.events,
        },
      );
      types.push(TYPES.TaskProgressBackend);
      this._container = createContainer(this.getContainerConfig(types));
      bindOnExitHandler(disposeContainer);
    } else {
      this._container = createContainer(
        this.getContainerConfig([TYPES.TaskProgressBackend])
      );
      bindOnExitHandler(disposeContainer);
      await getContainerAsyncInitializer();
      this._progressBackend = this.getProgressBackend();
      tasks = await (
        this._progressBackend instanceof TaskProgressFileBackend
          ? this._progressBackend.load()
          : this._progressBackend.loadAndClear()
      );

      addTypesToContainer({
        types: getRequiredServicesFromTasks(
          tasks,
          this._config.ncgc.caching.cist.priorities,
        ),
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
          types: getRequiredServicesFromTasks(
            [task],
            this._config.ncgc.caching.cist.priorities,
          ),
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

    bindOnExitHandler(dispose, true);
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
    for await (const results of this._taskRunner.asRunnableGenerator()) {
      for (const result of results) {
        if (result.isError) {
          const message = `Error while executing task ${result.taskType}`;
          this._logger.error('step' in result
            ? `${message}, step ${result.step}`
            : message, result.value);
        }
      }
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
  if (args.events && args.deleteIrrelevantEvents) {
    tasks.push({
      taskType: TaskType.DeferredEnsureAndDeleteIrrelevantEvents
    });
  } else if (args.events) {
    tasks.push({
      taskType: TaskType.DeferredEnsureEvents
    });
  } else if (args.deleteIrrelevantEvents) {
    tasks.push({
      taskType: TaskType.DeferredEnsureEvents
    });
  }
  return tasks;
}
