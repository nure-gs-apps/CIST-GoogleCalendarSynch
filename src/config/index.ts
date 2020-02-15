import * as nconf from 'nconf';
import * as path from 'path';
import { promises as fs, constants } from 'fs';
import { Argv } from 'yargs';
import { getDefaultConfigDirectory } from './constants';
import { AppConfig, IFullAppConfig } from './types';
import iterate from 'iterare';
import { DeepPartial, DeepReadonly, Nullable, t } from '../@types';
import { commonCamelCase, objectEntries } from '../utils/common';
import * as YAML from 'yaml';
import * as TOML from '@iarna/toml';

let config: Nullable<IFullAppConfig> = null;

// tslint:disable-next-line:no-non-null-assertion
export const appConfigPrefix = nameof<IFullAppConfig>(c => c.ncgc);
export const environmentVariableDepthSeparator = '__';
const lowerCaseEnvVariableStart = `${appConfigPrefix}${environmentVariableDepthSeparator}`.toLowerCase();

export function tryGetConfigDirFromEnv() {
  // tslint:disable-next-line:no-non-null-assertion
  const configDirectoryEnvKey = `${lowerCaseEnvVariableStart}${nameof<AppConfig>(c => c.configDir)}`;
  return iterate(objectEntries(process.env))
    .filter(([key]) => isAppEnvConfigKey(key as string))
    .map(([key, value]) => t(transformAppEnvConfigKey(key as string), value))
    .filter(([key]) => key === configDirectoryEnvKey)
    .take(1).map(([, value]) => value).toArray()[0] ?? null;
}

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export const environment: Environment | string = process.env.NODE_ENV?.trim()
  .toLowerCase() || Environment.Development;

let configDirectory: Nullable<string> = null;

export function isConfigInitialized() {
  return !!config;
}

export function getFullConfig() {
  if (!config) {
    throwNotInitialized();
  }
  return config as DeepReadonly<IFullAppConfig>;
}

export function getConfig(): AppConfig {
  return getFullConfig().ncgc;
}

export function getConfigDirectory() {
  if (!configDirectory) {
    throwNotInitialized();
  }
  return configDirectory;
}

let initializeConfigPromise: Nullable<Promise<boolean>> = null;
export function initializeConfig<T extends IFullAppConfig>(argv: Argv<T>) {
  if (initializeConfigPromise) {
    return initializeConfigPromise;
  }
  if (config) {
    return Promise.resolve(false);
  }
  initializeConfigPromise = doInitializeConfig(argv).then(() => true);

  return initializeConfigPromise;
}

async function doInitializeConfig<T extends DeepPartial<IFullAppConfig>>(
  argv: Argv<T>
) {
  nconf.argv(argv).env({
    transform(obj: { key: string, value: any}) {
      if (isAppEnvConfigKey(obj.key)) {
        obj.key = transformAppEnvConfigKey(obj.key);
      }
      return obj;
    },
    separator: environmentVariableDepthSeparator,
    parseValues: true,
    readOnly: true,
  }).defaults({
    ncgc: {
      configDir: getDefaultConfigDirectory()
    }
  } as DeepPartial<IFullAppConfig>);
  const configDir = normalizeConfigDirPath(
    (nconf.get() as IFullAppConfig).ncgc.configDir
  );

  if (
    await fs.access(configDir, constants.R_OK | constants.F_OK)
      .catch(() => true)
    || !(await fs.stat(configDir)).isDirectory()
  ) {
    throw new TypeError(`Could not find path to config directory: ${configDir}`);
  }
  configDirectory = configDir;
  nconf.set(
    nameof.full<IFullAppConfig>(c => c.ncgc.configDir).replace(/\./g, ':'),
    configDirectory
  );

  const files = [
    `local-${environment}`,
    'local',
    environment,
    'default',
  ].flatMap(b => fileExtensionsAndFormats.map(
    ([ext, format]) => t(`${b}${ext}`, format),
  ));
  for (const [fileName, format] of files) {
    // NOTE: `dir: string` and `search: boolean` may be added to sniff child directories for configs
    nconf.file(fileName, {
      format,
      file: path.join(configDirectory, fileName),
    });
  }
  config = nconf.get();
}

function normalizeConfigDirPath(possiblePath: string) {
  const configDirectory = path.normalize(possiblePath.trim());
  return path.isAbsolute(configDirectory)
    ? configDirectory
    : path.resolve(configDirectory);
}

const fileExtensionsAndFormats = [
  t('.toml', TOML),
  t('.yml', YAML),
  t('.yaml', YAML),
  t('.json', JSON),
] as ReadonlyArray<[string, nconf.IFormat]>;

function isAppEnvConfigKey(key: string) {
  return key.slice(
    0,
    lowerCaseEnvVariableStart.length,
  ).toLowerCase() === lowerCaseEnvVariableStart;
}

function transformAppEnvConfigKey(key: string) {
  return key.split(environmentVariableDepthSeparator)
    .map(commonCamelCase)
    .join(environmentVariableDepthSeparator);
}

function throwNotInitialized(): never {
  throw new TypeError('Config is not initialized');
}
