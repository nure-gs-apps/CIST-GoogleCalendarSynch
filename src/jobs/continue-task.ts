import { Container, interfaces } from 'inversify';
import { DeepReadonly, DeepReadonlyArray } from '../@types';
import { IInfoLogger } from '../@types/logging';
import { ITaskDefinition, ITaskProgressBackend } from '../@types/tasks';
import { IFullAppConfig } from '../config/types';
import {
  addTypesToContainer,
  createContainer,
  disposeContainer,
  getContainerAsyncInitializer, IAddContainerTypes,
} from '../di/container';
import { TYPES } from '../di/types';
import { CachedCistJsonClientService } from '../services/cist/cached-cist-json-client.service';
import { bindOnExitHandler } from '../services/exit-handler.service';
import ServiceIdentifier = interfaces.ServiceIdentifier;

export async function handleContinueTask(
  config: DeepReadonly<IFullAppConfig>,
  logger: IInfoLogger,
) {
  let container = createContainer({
    types: [TYPES.TaskProgressBackend],
    forceNew: true,
  });
  bindOnExitHandler(disposeContainer);
  await getContainerAsyncInitializer();
  const backend = container.get<ITaskProgressBackend>(
    TYPES.TaskProgressBackend
  );
  const tasks = await backend.loadAndClear();

  addTypesToContainer(getRequiredServicesConfig(tasks));
  await getContainerAsyncInitializer();

  container.bind<CachedCistJsonClientService>(TYPES.CistJsonClient)
    .to(CachedCistJsonClientService);
  await getContainerAsyncInitializer([CachedCistJsonClientService]);

}

function getRequiredServicesConfig(
  tasks: DeepReadonlyArray<ITaskDefinition<any>>,
): Partial<IAddContainerTypes> {
  const types = [] as ServiceIdentifier<any>[];
  return { types };
}
