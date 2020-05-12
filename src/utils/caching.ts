import { ReadonlyDate } from 'readonly-date';
import { CachedValue } from '../services/caching/cached-value';

export async function disposeChain<T>(cachedValue: CachedValue<T>) {
  const disposables = [cachedValue.dispose()];
  let currentValue = cachedValue;
  while (currentValue.needsSource && currentValue.source) {
    disposables.push(currentValue.source.dispose());
    currentValue = currentValue.source;
  }
  return Promise.all(disposables);
}

export async function setExpirationInChain<T>(
  cachedValue: CachedValue<T>,
  expiration: ReadonlyDate,
) {
  for (const value of getReversedChain(cachedValue)) {
    await value.setExpiration(expiration);
  }
}

export function getReversedChain<T>(cachedValue: CachedValue<T>) {
  const queue = [cachedValue];
  let currentValue = cachedValue;
  while (currentValue.needsSource && currentValue.source) {
    queue.unshift(currentValue);
    currentValue = currentValue.source;
  }
  return queue;
}

export async function destroyChain<T>(cachedValue: CachedValue<T>) {
  const disposables = [];
  if (cachedValue.isDestroyable) {
    disposables.push(cachedValue.destroy());
  }
  let currentValue = cachedValue;
  while (currentValue.needsSource && currentValue.source) {
    if (currentValue.isDestroyable) {
      disposables.push(currentValue.source.destroy());
    }
    currentValue = currentValue.source;
  }
  return Promise.all(disposables);
}
