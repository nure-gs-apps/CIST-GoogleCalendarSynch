import { DeepReadonly } from '../@types';
import { IEntitiesToOperateOn } from '../@types/jobs';
import { IFullAppConfig } from '../config/types';

export async function handleCistCacheExtend(
  args: IEntitiesToOperateOn,
  newExpiration: Date,
  config: DeepReadonly<IFullAppConfig>
) {

}
