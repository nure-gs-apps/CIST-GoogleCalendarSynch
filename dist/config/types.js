"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/* tslint:disable:ter-indent */
const yargs = require("yargs");
const constants_1 = require("./constants");
const change_case_1 = require("change-case");
function getBasicCliConfiguration() {
    // FIXME: add overrides for quotas object (seems to long options)
    return yargs
        .option(o("ncgc.configDir"), {
        alias: 'd',
        type: 'string',
        default: constants_1.getDefaultConfigDirectory(),
        description: 'Path to directory of configs',
    })
        .option(o("ncgc.cist.baseUrl"), {
        type: 'string',
        description: 'NURE CIST server URL with path to API',
    })
        .option(o("ncgc.cist.apiKey"), {
        type: 'string',
        description: 'NURE CIST Events API key (requested manually from NURE CIST authorities)',
    })
        .option(o("ncgc.google.idPrefix"), {
        type: 'string',
        description: 'Prefix used in IDs of the system for Google Calendar entities (buildings, rooms, etc.)',
    })
        // TODO: add prefix for calendar if needed
        .option(o("ncgc.google.calendar.timeZone"), {
        type: 'string',
        description: 'Google Calendar\'s timezone',
    })
        .option(o("ncgc.google.auth.subjectEmail"), {
        type: 'string',
        description: 'Google G-Suite\'s user email on behalf of which manipulations are done',
    })
        .option(o("ncgc.google.auth.keyFilepath"), {
        type: 'string',
        description: 'Google G-Suite\'s path to file with JSON key',
    });
}
exports.getBasicCliConfiguration = getBasicCliConfiguration;
function o(paramName) {
    return paramName
        .split('.')
        .map(p => change_case_1.paramCase(p, {}))
        .join('.');
}
//# sourceMappingURL=types.js.map