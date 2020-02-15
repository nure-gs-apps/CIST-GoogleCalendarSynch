"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const nconf = require("nconf");
const path = require("path");
const fs_1 = require("fs");
const constants_1 = require("./constants");
const iterare_1 = require("iterare");
const _types_1 = require("../@types");
const common_1 = require("../utils/common");
const YAML = require("yaml");
const TOML = require("@iarna/toml");
const config = null;
// tslint:disable-next-line:no-non-null-assertion
exports.appConfigPrefix = "ncgc";
exports.environmentVariableDepthSeparator = '__';
const lowerCaseEnvVariableStart = `${exports.appConfigPrefix}${exports.environmentVariableDepthSeparator}`.toLowerCase();
function tryGetConfigDirFromEnv() {
    var _a;
    // tslint:disable-next-line:no-non-null-assertion
    const configDirectoryEnvKey = `${lowerCaseEnvVariableStart}${"configDir"}`;
    return _a = iterare_1.default(common_1.objectEntries(process.env))
        .filter(([key]) => isAppEnvConfigKey(key))
        .map(([key, value]) => _types_1.t(transformAppEnvConfigKey(key), value))
        .filter(([key]) => key === configDirectoryEnvKey)
        .take(1).map(([, value]) => value).toArray()[0], (_a !== null && _a !== void 0 ? _a : null);
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
    var _a, _b, _c, _d;
    const configDirectoryOverrides = [
        (_b = (_a = argv.argv) === null || _a === void 0 ? void 0 : _a.ncgc) === null || _b === void 0 ? void 0 : _b.configDir,
        tryGetConfigDirFromEnv(),
    ].filter(v => typeof v === 'string');
    const configDir = normalizeConfigDirPath(configDirectoryOverrides[0] || constants_1.defaultConfigDirectory);
    const stat = await fs_1.promises.stat(configDir);
    if (!stat.isDirectory()) {
        const invalidCommandLine = 'Command line argument is invalid.';
        let message = `Could not find path to config directory: ${configDir}. `;
        switch (configDirectoryOverrides.length) {
            case 0:
                message += 'No overrides found, default directory does not exist!';
                break;
            case 1:
                message += typeof ((_d = (_c = argv.argv) === null || _c === void 0 ? void 0 : _c.ncgc) === null || _d === void 0 ? void 0 : _d.configDir) === 'string'
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