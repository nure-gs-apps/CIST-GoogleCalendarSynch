"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config = require("config");
exports.prependIdPrefix = (() => {
    const idPrefix = config.get('google.idPrefix');
    const prefixIsValid = idPrefix === null || (typeof idPrefix === 'string'
        && /^\w+$/.test(idPrefix));
    if (!prefixIsValid) {
        throw new TypeError('idPrefix must be a alphanumeral string or null to omit');
    }
    return prefixIsValid
        ? (id) => `${idPrefix}.${id}`
        : (id) => id;
})();
exports.customer = 'my_customer';
exports.domainName = config.get('google.auth.subjectEmail').split('@')[1].toLowerCase();
exports.directoryAuthScopes = [
    'https://www.googleapis.com/auth/admin.directory.resource.calendar',
    'https://www.googleapis.com/auth/admin.directory.group',
];
exports.calenderAuthScopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
];
//# sourceMappingURL=constants.js.map