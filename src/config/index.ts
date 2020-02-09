import * as nconf from 'nconf';
import * as path from 'path';
import { promises as fs } from 'fs';
import { path as appRootPath } from 'app-root-path';
import * as yargs from 'yargs';
import { Argv } from "yargs";
import { IAppConfig } from "./types";
import iterate from "iterare";
import { Nullable } from "../@types";

export const configPrefix = 'ncgc';
export const environmentVariableDepthDelimiter = '__';
export const configDirectoryKey = nameof<IAppConfig['configDir']>();
export const configDirectoryEnvironmentVariable = `${configPrefix}${environmentVariableDepthDelimiter}${configDirectoryKey}`;
export const defaultConfigDirectory = path.join(appRootPath, 'config');

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test'
}

export const environment: Environment | string = process.env.NODE_ENV?.trim()
  .toLowerCase() || Environment.Development;

let config: Nullable<IAppConfig> = null;
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

export async function initializeConfig<T extends IAppConfig>(argv: Argv<T>) {
  if (config) {
    return false;
  }
  const configDirectoryOverrides = [
    process.env[configDirectoryEnvironmentVariable],
    argv.argv.configDir
  ].filter(v => typeof v === 'string');
  const configDir = normalizeConfigDirPath(
    configDirectoryOverrides[0] || defaultConfigDirectory
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
        message += typeof argv.argv.configDir === 'string'
          ? invalidCommandLine
          : 'Environmental variable is invalid.';
        break;

      case 2:
        message += invalidCommandLine;
    }
    throw new TypeError(message);
  }
  configDirectory = configDir;
  await initializeNconf(argv);

  return true;
}

function normalizeConfigDirPath(possiblePath: string) {
  const configDirectory = path.normalize(possiblePath.trim());
  return path.isAbsolute(configDirectory) ? configDirectory : path.resolve(configDirectory);
}

async function initializeNconf<T extends IAppConfig>(argv: Argv<T>) {
  nconf.argv(argv);
  nconf.env({
    parseValues: true,
    delimiter: environmentVariableDepthDelimiter,
    readOnly: true,
  });
}

function throwNotInitialized() {
  if (!config) {
    throw new TypeError('Config is not initialized');
  }
}

