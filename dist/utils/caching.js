"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
async function disposeChain(cachedValue) {
    const disposables = [cachedValue.dispose()];
    let currentValue = cachedValue;
    while (currentValue.needsSource && currentValue.source) {
        disposables.push(currentValue.source.dispose());
        currentValue = currentValue.source;
    }
    return Promise.all(disposables);
}
exports.disposeChain = disposeChain;
async function setExpirationInChain(cachedValue, expiration) {
    for (const value of getReversedChain(cachedValue)) {
        await value.setExpiration(expiration);
    }
}
exports.setExpirationInChain = setExpirationInChain;
function getReversedChain(cachedValue) {
    const queue = [cachedValue];
    let currentValue = cachedValue;
    while (currentValue.needsSource && currentValue.source) {
        queue.unshift(currentValue);
        currentValue = currentValue.source;
    }
    return queue;
}
exports.getReversedChain = getReversedChain;
async function destroyChain(cachedValue) {
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
exports.destroyChain = destroyChain;
//# sourceMappingURL=caching.js.map