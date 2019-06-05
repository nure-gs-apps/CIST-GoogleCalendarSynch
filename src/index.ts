// IMPORTANT! INSTALLS MONKEY PATCHES
import './@types';
// initialize exit handlers
import './services/exit-handler.service';
import { CistClient } from './services/cist-client.service';
import { logger } from './services/logger.service';
import { assertRoomResponse } from './utils/assert-responses';

async function main() {
  const cistClient = new CistClient();
  const response = await cistClient.getRoomResponse();
  assertRoomResponse(response);
}
main();
