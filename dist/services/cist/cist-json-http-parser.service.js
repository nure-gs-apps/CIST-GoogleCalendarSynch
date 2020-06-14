"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const inversify_1 = require("inversify");
let CistJsonHttpParserService = class CistJsonHttpParserService {
    parseRoomsResponse(response) {
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
        // Fixing body deficiencies
        const fixedBody = response.data
            .replace(/"events"\s*:\s*\[\s*]\s*}\s*]/g, '"events":[]')
            .replace(/"type":\s*,/g, '"type":0,');
        return JSON.parse(fixedBody);
    }
};
CistJsonHttpParserService = tslib_1.__decorate([
    inversify_1.injectable()
], CistJsonHttpParserService);
exports.CistJsonHttpParserService = CistJsonHttpParserService;
//# sourceMappingURL=cist-json-http-parser.service.js.map