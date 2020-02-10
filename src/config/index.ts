import * as nconf from 'nconf';
import * as path from 'path';
import { promises as fs } from 'fs';
import { path as appRootPath } from 'app-root-path';
import { Argv } from 'yargs';
import { IFullAppConfig } from './types';
import iterate from 'iterare';
import { Nullable } from '../@types';
import { commonCamelCase, objectKeys } from '../utils/common';
import * as YAML from 'yaml';
import * as TOML from '@iarna/toml';

export const appConfigPrefix = nameof<IFullAppConfig['ncgc']>();
export const environmentVariableDepthSeparator = '__';
const lowerCaseEnvVariableStart = `${appConfigPrefix}${environmentVariableDepthSeparator}`.toLowerCase();
export const configDirectoryKey = nameof<IFullAppConfig['ncgc']['configDir']>();
export const defaultConfigDirectory = path.join(appRootPath, 'config');

export function tryGetConfigDirFromEnv() {
  return process.env[transformAppEnvConfigKey(iterate(objectKeys(process.env))
      .filter(key => isAppEnvConfigKey(key)).take(1).toArray()[0],
  )];
}

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export const environment: Environment | string = process.env.NODE_ENV?.trim()
  .toLowerCase() || Environment.Development;

const config: Nullable<IFullAppConfig> = null;
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

export function getConfigDirectory() {
  if (!configDirectory) {
    throwNotInitialized();
  }
  return configDirectory;
}

export async function initializeConfig<T extends IFullAppConfig>(argv: Argv<T>) {
  if (config) {
    return false;
  }
  const configDirectoryOverrides = [
    tryGetConfigDirFromEnv(),
    argv.argv.ncgc.configDir,
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
        message += typeof argv.argv.ncgc.configDir === 'string'
          ? invalidCommandLine
          : 'Environmental variable is invalid.';
        break;

      case 2:
        message += invalidCommandLine;
    }
    throw new TypeError(message);
  }
  configDirectory = configDir;
  await initializeNconfSync(argv);

  return true;
}

function normalizeConfigDirPath(possiblePath: string) {
  const configDirectory = path.normalize(possiblePath.trim());
  return path.isAbsolute(configDirectory)
    ? configDirectory
    : path.resolve(configDirectory);
}

function initializeNconfSync<T extends IFullAppConfig>(argv: Argv<T>) {
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
  ].flatMap(
    b => [
      ['.json', JSON],
      ['.yaml', YAML],
      ['.yml', YAML],
      ['.toml', TOML],
    ].map(ext => `${b}${ext}`),
  ).map(f => path.join(getConfigDirectory(), f));
  const directory = getConfigDirectory();
  for (const fileName of files) {
    // NOTE: `dir: string` and `search: boolean` may be added to sniff child directories for configs
    nconf.file(fileName, {
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
