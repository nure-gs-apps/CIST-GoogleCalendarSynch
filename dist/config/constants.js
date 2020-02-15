"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_root_path_1 = require("app-root-path");
const path = require("path");
function getDefaultConfigDirectory() {
    return path.join(app_root_path_1.path, 'config');
}
exports.getDefaultConfigDirectory = getDefaultConfigDirectory;
//# sourceMappingURL=constants.js.map