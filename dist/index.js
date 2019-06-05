"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// IMPORTANT! INSTALLS MONKEY PATCHES
require("./@types");
require("./di/types");
// initialize exit handlers
require("./services/exit-handler.service");
const container_1 = require("./di/container");
const cist_json_client_service_1 = require("./services/cist-json-client.service");
const assert_responses_1 = require("./utils/assert-responses");
const container = container_1.createContainer();
container_1.getAsyncInitializers().then(main);
async function main() {
    const response = await container.get(cist_json_client_service_1.CistJsonClient)
        .getRoomResponse();
    assert_responses_1.assertRoomResponse(response);
}
//# sourceMappingURL=index.js.map