import { DeepReadonly } from '../@types';
import { IEntitiesToOperateOn } from '../@types/jobs';
import { IInfoLogger } from '../@types/logging';
import { IFullAppConfig } from '../config/types';
import { createContainer } from '../di/container';
import { TYPES } from '../di/types';
import { getCistCachedClientTypes } from '../utils/jobs';

export function handleSync(
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
}
