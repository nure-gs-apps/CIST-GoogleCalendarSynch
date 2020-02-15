import { path as appRootPath } from 'app-root-path';
import * as path from 'path';

export function getDefaultConfigDirectory() {
  return path.join(appRootPath, 'config');
}
