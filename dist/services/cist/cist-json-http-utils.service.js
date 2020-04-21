"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const inversify_1 = require("inversify");
let CistJsonHttpUtilsService = class CistJsonHttpUtilsService {
    parseAuditoriesResponse(response) {
        const body = response.data;
        if (typeof body !== 'string') {
            throw new TypeError('Unexpected non-string response');
        }
        // Fixing body deficiencies
        const fixedBody = body.replace(/\[\s*}\s*]/g, '[]');
        return JSON.parse(fixedBody);
    }
    parseGroupsResponse(response) {
        if (typeof response.data !== 'string') {
            throw new TypeError('Unexpected non-string response');
        }
        return JSON.parse(response.data);
    }
    parseEventsResponse(response) {
        if (typeof response.data !== 'string') {
            throw new TypeError('Unexpected non-string response');
        }
        return JSON.parse(response.data);
    }
};
CistJsonHttpUtilsService = tslib_1.__decorate([
    inversify_1.injectable()
], CistJsonHttpUtilsService);
exports.CistJsonHttpUtilsService = CistJsonHttpUtilsService;
//# sourceMappingURL=cist-json-http-utils.service.js.map