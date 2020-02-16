import { injectable } from 'inversify';
import { getConfig, getFullConfig } from './index';

@injectable()
export class ConfigService {
  get config() {
    return getConfig();
  }
  get fullConfig() {
    return getFullConfig();
  }
}
