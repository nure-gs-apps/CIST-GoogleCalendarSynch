// IMPORTANT! INSTALLS MONKEY PATCHES
import './@types';
import './di/types';
// initialize exit handlers
import './services/exit-handler.service';
import { createContainer, getAsyncInitializers } from './di/container';
import { CistJsonClient } from './services/cist-json-client.service';
import { assertRoomResponse } from './utils/assert-responses';

const container = createContainer();
getAsyncInitializers().then(main);

async function main() {
  const response = await container.get<CistJsonClient>(CistJsonClient)
    .getRoomResponse();
  assertRoomResponse(response);
}
