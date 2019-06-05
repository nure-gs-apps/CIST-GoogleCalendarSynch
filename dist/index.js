"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// IMPORTANT! INSTALLS MONKEY PATCHES
require("./@types");
// initialize exit handlers
require("./services/exit-handler.service");
const cist_client_service_1 = require("./services/cist-client.service");
const assert_responses_1 = require("./utils/assert-responses");
async function main() {
    const cistClient = new cist_client_service_1.CistClient();
    const response = await cistClient.getRoomResponse();
    assert_responses_1.assertRoomResponse(response);
}
main();
//# sourceMappingURL=index.js.map