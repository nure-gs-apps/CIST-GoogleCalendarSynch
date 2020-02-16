"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const inversify_1 = require("inversify");
const index_1 = require("./index");
let ConfigService = class ConfigService {
    get config() {
        return index_1.getConfig();
    }
    get fullConfig() {
        return index_1.getFullConfig();
    }
};
ConfigService = tslib_1.__decorate([
    inversify_1.injectable()
], ConfigService);
exports.ConfigService = ConfigService;
//# sourceMappingURL=config.service.js.map