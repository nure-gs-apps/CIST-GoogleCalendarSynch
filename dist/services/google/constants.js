"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config = require("config");
exports.idPrefix = config.get('google.idPrefix') || 'cist';
if (!/^\w*$/.test(exports.idPrefix)) {
    throw new TypeError('idPrefix must be a alphanumeral string');
}
exports.customer = 'my_customer';
exports.adminAuthScopes = [
    'https://www.googleapis.com/auth/admin.directory.resource.calendar',
];
exports.calenderAuthScopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
];
//# sourceMappingURL=constants.js.map