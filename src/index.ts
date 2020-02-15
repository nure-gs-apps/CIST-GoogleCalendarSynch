// IMPORTANT! INSTALLS MONKEY PATCHES
import './polyfills';
import { getConfig, initializeConfig } from './config';
import { getBasicCliConfiguration } from './config/types';

const yargs = getBasicCliConfiguration()
  .help();

initializeConfig(yargs).then(() => {
  // import('./main').catch(failStart);
  console.log(getConfig());
}).catch(failStart);

function failStart(error: any) {
  console.error(error);
  process.exit(1);
}
