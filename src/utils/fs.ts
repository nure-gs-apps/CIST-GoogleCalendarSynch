import { PathLike, promises as fs } from 'fs';
import { Optional } from '../@types';

export interface IFileReadResult {
  bytesRead: number;
  buffer: Buffer;
}

export interface IFileReadUntilResult {
  found: boolean;
  contents: Buffer;
}

export async function fSize(file: fs.FileHandle) {
  return (await file.stat()).size;
}

export async function fReadFile(file: fs.FileHandle, encoding: BufferEncoding) {
  const buffer = Buffer.alloc(await fSize(file));
  await file.read(buffer, 0, buffer.length, 0);
  return buffer.toString(encoding);
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
    readResult = await file.read(readBuffer, i, readChunkSize, 0);
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

export async function fCutOut(
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
    readResult = await file.read(readBuffer, readOffset, length, 0);
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

export async function fShiftForward(
  file: fs.FileHandle,
  start: number,
  offset: number,
  chunkBufferSize = 256
) {
  if (offset < 0) {
    throw new TypeError('fs: Offset must be positive');
  }
  if (offset === 0) {
    return;
  }
  const size = (await file.stat()).size;
  if (start >= size) {
    return;
  }
  let readOffset = Math.round((
    size - start
  ) / chunkBufferSize) * chunkBufferSize + start;
  let writeOffset = readOffset + offset;

  const readBuffer = Buffer.alloc(chunkBufferSize);
  let readResult: IFileReadResult;
  do {
    readResult = await file.read(readBuffer, readOffset, chunkBufferSize, 0);
    await file.write(readBuffer, writeOffset, readResult.bytesRead);
    readOffset -= chunkBufferSize;
    writeOffset -= chunkBufferSize;
  } while (readOffset >= start);
}

export function fAccess(path: PathLike, mode: Optional<number>) {
  return fs.access(path, mode).then(() => true).catch(() => false);
}
