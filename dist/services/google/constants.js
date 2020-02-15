"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("../../config");
exports.prependIdPrefix = (() => {
    const idPrefix = config_1.getConfig().google.idPrefix; // TODO: move to helper service
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
exports.domainName = config_1.getConfig().google.auth.subjectEmail.split('@')[1].toLowerCase(); // TODO: move to helper service
exports.directoryAuthScopes = [
    'https://www.googleapis.com/auth/admin.directory.resource.calendar',
    'https://www.googleapis.com/auth/admin.directory.group',
];
exports.calenderAuthScopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
];
//# sourceMappingURL=constants.js.map