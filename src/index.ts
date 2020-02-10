// IMPORTANT! INSTALLS MONKEY PATCHES
import './polyfills';
import { initializeConfig } from './config';

initializeConfig(null as any).then(() => {
  import('./main').catch(failStart);
}).catch(failStart);

function failStart(error: any) {
  console.error(error);
  process.exit(1);
}
