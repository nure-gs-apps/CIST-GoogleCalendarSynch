export function arrayContentEqual<T>(
  first: ReadonlyArray<T>,
  second: ReadonlyArray<T>,
) {
  return first.length === second.length && first.every(e => second.includes(e));
}

export function toBase64(value: string) {
  return Buffer.from(value).toString('base64');
}

export function dateToSeconds(date: Date) {
  return Math.round(date.getTime() / 1000);
}
