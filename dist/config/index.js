"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const nconf = require("nconf");
const path = require("path");
const fs_1 = require("fs");
const app_root_path_1 = require("app-root-path");
const iterare_1 = require("iterare");
const common_1 = require("../utils/common");
const YAML = require("yaml");
const TOML = require("@iarna/toml");
const config = null;
exports.appConfigPrefix = "ncgc";
exports.environmentVariableDepthSeparator = '__';
const lowerCaseEnvVariableStart = `${exports.appConfigPrefix}${exports.environmentVariableDepthSeparator}`.toLowerCase();
exports.defaultConfigDirectory = path.join(app_root_path_1.path, 'config');
function tryGetConfigDirFromEnv() {
    const configDirectoryEnvKey = `${lowerCaseEnvVariableStart}${"configDir"}`;
    return process.env[iterare_1.default(common_1.objectKeys(process.env))
        .filter(key => isAppEnvConfigKey(key))
        .map(transformAppEnvConfigKey)
        .filter(key => key === configDirectoryEnvKey)
        .take(1).toArray()[0]];
}
exports.tryGetConfigDirFromEnv = tryGetConfigDirFromEnv;
var Environment;
(function (Environment) {
    Environment["Development"] = "development";
    Environment["Production"] = "production";
    Environment["Test"] = "test";
})(Environment = exports.Environment || (exports.Environment = {}));
exports.environment = ((_a = process.env.NODE_ENV) === null || _a === void 0 ? void 0 : _a.trim().toLowerCase()) || Environment.Development;
let configDirectory = null;
function isConfigInitialized() {
    return !!config;
}
exports.isConfigInitialized = isConfigInitialized;
function getFullConfig() {
    if (!config) {
        throwNotInitialized();
    }
    return config;
}
exports.getFullConfig = getFullConfig;
function getConfig() {
    return getFullConfig().ncgc;
}
exports.getConfig = getConfig;
function getConfigDirectory() {
    if (!configDirectory) {
        throwNotInitialized();
    }
    return configDirectory;
}
exports.getConfigDirectory = getConfigDirectory;
let initializeConfigPromise = null;
function initializeConfig(argv) {
    if (initializeConfigPromise) {
        return initializeConfigPromise;
    }
    if (config) {
        return Promise.resolve(false);
    }
    initializeConfigPromise = doInitializeConfig(argv).then(() => true);
    return initializeConfigPromise;
}
exports.initializeConfig = initializeConfig;
async function doInitializeConfig(argv) {
    const configDirectoryOverrides = [
        tryGetConfigDirFromEnv(),
        argv.argv.ncgc.configDir,
    ].filter(v => typeof v === 'string');
    const configDir = normalizeConfigDirPath(configDirectoryOverrides[0] || exports.defaultConfigDirectory);
    const stat = await fs_1.promises.stat(configDir);
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
    initializeNconfSync(argv);
}
function normalizeConfigDirPath(possiblePath) {
    const configDirectory = path.normalize(possiblePath.trim());
    return path.isAbsolute(configDirectory)
        ? configDirectory
        : path.resolve(configDirectory);
}
const fileExtensionsAndFormats = [
    ['.json', JSON],
    ['.yaml', YAML],
    ['.yml', YAML],
    ['.toml', TOML],
];
function initializeNconfSync(argv) {
    nconf.argv(argv).env({
        transform(obj) {
            if (isAppEnvConfigKey(obj.key)) {
                obj.key = transformAppEnvConfigKey(obj.key);
            }
            return obj;
        },
        separator: exports.environmentVariableDepthSeparator,
        parseValues: true,
        readOnly: true,
    });
    const files = [
        'default',
        exports.environment,
        'local',
        `local-${exports.environment}`,
    ].flatMap(b => fileExtensionsAndFormats.map(([ext, format]) => [`${b}${ext}`, format])).map(([extension, format]) => [
        path.join(getConfigDirectory(), extension),
        format,
    ]);
    const directory = getConfigDirectory();
    for (const [fileName, format] of files) {
        // NOTE: `dir: string` and `search: boolean` may be added to sniff child directories for configs
        nconf.file(fileName, {
            format,
            file: path.join(directory, fileName),
        });
    }
}
function isAppEnvConfigKey(key) {
    return key.slice(0, lowerCaseEnvVariableStart.length).toLowerCase() === lowerCaseEnvVariableStart;
}
function transformAppEnvConfigKey(key) {
    return key.split(exports.environmentVariableDepthSeparator)
        .map(common_1.commonCamelCase)
        .join(exports.environmentVariableDepthSeparator);
}
function throwNotInitialized() {
    throw new TypeError('Config is not initialized');
}
//# sourceMappingURL=index.js.map