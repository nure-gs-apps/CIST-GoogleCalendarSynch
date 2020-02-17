"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/* tslint:disable:ter-indent */
const yargs = require("yargs");
const constants_1 = require("./constants");
const change_case_1 = require("change-case");
const index_1 = require("./index");
function getBasicCliConfiguration() {
    // FIXME: add overrides for quotas object (seems too long options)
    return yargs
        .parserConfiguration({
        'sort-commands': false,
        'boolean-negation': true,
        'camel-case-expansion': true,
        'combine-arrays': true,
        'dot-notation': true,
        'duplicate-arguments-array': true,
        'flatten-duplicate-arrays': false,
        'halt-at-non-option': false,
        'negation-prefix': 'no-',
        'parse-numbers': true,
        'populate--': false,
        'set-placeholder-key': false,
        'short-option-groups': true,
        'strip-aliased': true,
        'strip-dashed': true,
        'unknown-options-as-args': true // allows usage of undocumented options (not in help)
    })
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
function assertConfigPrefixId() {
    const config = index_1.getConfig();
    const idPrefix = config.google.idPrefix; // TODO: move to helper service
    const prefixIsValid = idPrefix === null || idPrefix === '' || (typeof idPrefix === 'string'
        && /^\w+$/.test(idPrefix));
    if (!prefixIsValid) {
        throw new TypeError('idPrefix must be a alphanumeral string or null to omit');
    }
}
exports.assertConfigPrefixId = assertConfigPrefixId;
function o(paramName) {
    return paramName
        .split('.')
        .map(p => change_case_1.paramCase(p, {}))
        .join('.');
}
//# sourceMappingURL=types.js.map