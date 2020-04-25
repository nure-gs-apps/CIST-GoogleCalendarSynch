import { promises as fs } from 'fs';

export interface IFileReadResult {
  bytesRead: number;
  buffer: Buffer;
}

export interface IFileReadUntilResult {
  found: boolean;
  contents: Buffer;
}

export async function fReadUntil(
  file: fs.FileHandle,
  stopWord: Buffer,
  offset = 0,
  readChunkSize = 64,
): Promise<IFileReadUntilResult> {
  let contents = Buffer.alloc(0);
  const readBuffer = Buffer.alloc(readChunkSize);
  let i = offset;
  let readResult: IFileReadResult;
  do {
    readResult = await file.read(readBuffer, i, readChunkSize);
    let found = false;
    if (stopWord.length < readChunkSize) {
      const j = readBuffer.indexOf(stopWord);
      if (j >= 0) {
        found = true;
        contents = Buffer.concat([contents, readBuffer.slice(0, j)]);
      }
    } else if (stopWord.length === readChunkSize) {
      found = readBuffer.equals(stopWord);
    } else {
      const lengthDifference = stopWord.length - readChunkSize;
      const readStart = readBuffer.slice(0, -lengthDifference);
      if (readStart.compare(
        contents,
        contents.length - lengthDifference,
        contents.length
      ) === 0 && readBuffer.compare(
        stopWord,
        stopWord.length - lengthDifference,
      ) === 0) {
        found = true;
        contents = contents.slice(0, -lengthDifference);
      }
    }
    if (found) {
      return { contents, found };
    }
    if (readResult.bytesRead === readChunkSize) {
      contents = Buffer.concat([contents, readBuffer]);
    } else {
      contents = Buffer.concat([
        contents,
        readBuffer.slice(0, readResult.bytesRead)
      ]);
      break;
    }
    i += readChunkSize;
  } while (true);
  return { contents, found: false };
}

export async function fCutInside(
  file: fs.FileHandle,
  start: number,
  length: number,
  chunkBufferSize = 256
) {
  const size = (await file.stat()).size;
  let writeOffset = start >= 0 ? start : size - start;
  let readOffset = writeOffset + length;
  if (writeOffset >= size) {
    return;
  }
  if (readOffset >= size) {
    await file.truncate(writeOffset);
    return;
  }
  const readBuffer = Buffer.alloc(chunkBufferSize);
  let readResult: IFileReadResult;
  do {
    readResult = await file.read(readBuffer, readOffset, length);
    if (readResult.bytesRead === chunkBufferSize) {
      await file.write(readBuffer, writeOffset);
    } else {
      await file.write(readBuffer, writeOffset, readResult.bytesRead);
      await file.truncate(writeOffset + readResult.bytesRead);
      break;
    }
    readOffset += chunkBufferSize;
    writeOffset += chunkBufferSize;
  } while (true);
}
