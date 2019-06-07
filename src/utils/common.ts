export function arrayContentEqual<T>(
  first: ReadonlyArray<T>,
  second: ReadonlyArray<T>,
) {
  return first.length === second.length && first.every(e => second.includes(e));
}
