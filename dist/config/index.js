"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const nconf = require("nconf");
const path = require("path");
const graceful_fs_1 = require("graceful-fs");
const _types_1 = require("../@types");
const fs_1 = require("../utils/fs");
const constants_1 = require("./constants");
const types_1 = require("./types");
const common_1 = require("../utils/common");
const YAML = require("yaml");
const TOML = require("@iarna/toml");
let config = null;
exports.appConfigPrefix = "ncgc";
exports.environmentVariableDepthSeparator = '__';
const lowerCaseEnvVariableStart = `${exports.appConfigPrefix}${exports.environmentVariableDepthSeparator}`.toLowerCase();
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
const fileExtensionsAndFormats = (() => {
    class Format {
        constructor(format) {
            Object.defineProperty(this, "_format", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: void 0
            });
            this._format = format;
        }
        parse(str) {
            var _a;
            return (_a = this._format.parse(str)) !== null && _a !== void 0 ? _a : {};
        }
        stringify(obj, replacer, spacing) {
            return this._format.stringify(obj, replacer, spacing);
        }
    }
    const yaml = new Format(YAML);
    return [
        _types_1.t('.toml', new Format(TOML)),
        _types_1.t('.json', new Format(JSON)),
        _types_1.t('.yml', yaml),
        _types_1.t('.yaml', yaml),
    ];
})();
function getSupportedConfigExtensionsInPriorityOrder() {
    return fileExtensionsAndFormats.map(([ext]) => ext);
}
exports.getSupportedConfigExtensionsInPriorityOrder = getSupportedConfigExtensionsInPriorityOrder;
async function doInitializeConfig(argv) {
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
    }).defaults({
        ncgc: {
            configDir: constants_1.getDefaultConfigDirectory()
        }
    });
    const configDir = common_1.PathUtils.expandVars(normalizeConfigDirPath(nconf.get().ncgc.configDir));
    if (!await fs_1.fAccess(configDir, graceful_fs_1.constants.R_OK | graceful_fs_1.constants.F_OK)
        || !(await graceful_fs_1.promises.stat(configDir)).isDirectory()) {
        throw new TypeError(`Could not find path to config directory: ${configDir}`);
    }
    configDirectory = configDir;
    nconf.set("ncgc.configDir".replace(/\./g, ':'), configDirectory);
    const files = [
        `local-${exports.environment}`,
        'local',
        exports.environment,
        'default',
    ].flatMap(b => fileExtensionsAndFormats.map(([ext, format]) => _types_1.t(`${b}${ext}`, format)));
    for (const [fileName, format] of files) {
        // NOTE: `dir: string` and `search: boolean` may be added to sniff child directories for configs
        nconf.file(fileName, {
            format,
            file: path.join(configDirectory, fileName),
        });
    }
    config = nconf.get();
    types_1.assertConfigPrefixId();
}
function normalizeConfigDirPath(possiblePath) {
    const configDirectory = path.normalize(possiblePath.trim());
    return path.resolve(configDirectory);
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