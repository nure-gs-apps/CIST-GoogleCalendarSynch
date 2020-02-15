import * as nconf from 'nconf';
import * as path from 'path';
import { promises as fs } from 'fs';
import { Argv } from 'yargs';
import { defaultConfigDirectory } from './constants';
import { AppConfig, IFullAppConfig } from './types';
import iterate from 'iterare';
import { DeepPartial, Nullable, t } from '../@types';
import { commonCamelCase, objectEntries } from '../utils/common';
import * as YAML from 'yaml';
import * as TOML from '@iarna/toml';

const config: Nullable<IFullAppConfig> = null;

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
  return config;
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
  const configDirectoryOverrides = [
    argv.argv?.ncgc?.configDir,
    tryGetConfigDirFromEnv(),
  ].filter(v => typeof v === 'string');
  const configDir = normalizeConfigDirPath(
    configDirectoryOverrides[0] || defaultConfigDirectory,
  );

  const stat = await fs.stat(configDir);
  if (!stat.isDirectory()) {
    const invalidCommandLine = 'Command line argument is invalid.';
    let message = `Could not find path to config directory: ${configDir}. `;
    switch (configDirectoryOverrides.length) {
      case 0:
        message += 'No overrides found, default directory does not exist!';
        break;

      case 1:
        message += typeof argv.argv?.ncgc?.configDir === 'string'
          ? invalidCommandLine
          : 'Environmental variable is invalid.';
        break;

      case 2:
        message += invalidCommandLine;
    }
    throw new TypeError(message);
  }
  configDirectory = configDir;
  initializeNconfSync(argv);
}

function normalizeConfigDirPath(possiblePath: string) {
  const configDirectory = path.normalize(possiblePath.trim());
  return path.isAbsolute(configDirectory)
    ? configDirectory
    : path.resolve(configDirectory);
}

type ExtensionAndFormat = [string, nconf.IFormat];
const fileExtensionsAndFormats = [
  ['.json', JSON] as ExtensionAndFormat,
  ['.yaml', YAML] as ExtensionAndFormat,
  ['.yml', YAML] as ExtensionAndFormat,
  ['.toml', TOML] as ExtensionAndFormat,
] as ReadonlyArray<ExtensionAndFormat>;

function initializeNconfSync<T extends DeepPartial<IFullAppConfig>>(argv: Argv<T>) {
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
  });
  const files = [
    'default',
    environment,
    'local',
    `local-${environment}`,
  ].flatMap(b => fileExtensionsAndFormats.map(
      ([ext, format]) => [`${b}${ext}`, format] as ExtensionAndFormat,
  )).map(([extension, format]) => [
    path.join(getConfigDirectory(), extension),
    format,
  ] as ExtensionAndFormat);
  const directory = getConfigDirectory();
  for (const [fileName, format] of files) {
    // NOTE: `dir: string` and `search: boolean` may be added to sniff child directories for configs
    nconf.file(fileName, {
      format,
      file: path.join(directory, fileName),
    });
  }
}

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
