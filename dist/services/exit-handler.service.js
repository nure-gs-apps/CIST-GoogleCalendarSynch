"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const logging_1 = require("../@types/logging");
const exitTimeout = 3000;
let logger = logging_1.nullLogger;
function setExitLogger(newLogger) {
    logger = newLogger;
}
exports.setExitLogger = setExitLogger;
class ListNode {
    constructor(handler /*, prev?: Node*/, next = null) {
        // prev: Maybe<Node>;
        Object.defineProperty(this, "next", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "handler", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.handler = handler;
        this.next = next;
    }
}
class List {
    constructor(head = null) {
        Object.defineProperty(this, "head", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "tail", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_length", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.head = this.tail = head;
        this._length = head ? 1 : 0;
    }
    get length() {
        return this._length;
    }
    add(node, unshift = false) {
        if (!this.head) {
            this.tail = this.head = node;
        }
        else if (unshift) {
            node.next = this.head;
            this.head = node;
        }
        else {
            // tslint:disable-next-line:no-non-null-assertion
            this.tail.next = node;
            // tslint:disable-next-line:no-non-null-assertion
            this.tail = this.tail.next;
        }
        this._length += 1;
    }
    remove(handler) {
        if (this._length === 0) {
            return false;
        }
        // tslint:disable-next-line:no-non-null-assertion
        if (this.head.handler === handler) {
            // tslint:disable-next-line:no-non-null-assertion
            this.head = this.head.next;
            return true;
        }
        // tslint:disable-next-line:no-non-null-assertion
        let prev = this.head;
        while (prev.next) {
            if (prev.next.handler === handler) {
                prev.next = prev.next.next;
                this._length -= 1;
                return true;
            }
            prev = prev.next;
        }
        return false;
    }
    *[Symbol.iterator]() {
        let prev = this.head;
        while (prev) {
            yield prev.handler;
            prev = prev.next;
        }
    }
}
const list = new List();
let handled = false;
let onSignalHandler = null;
const errorHandler = (err, p) => {
    if (p) {
        logger.error('Unhandled promise rejection for ');
        logger.error(p);
    }
    else {
        logger.error('Unhandled exception!');
    }
    logger.error(err);
    execHandlers().catch(err => {
        logger.error('The process is not shut down gracefully! Error while error handling.');
        logger.error(err);
    }).finally(() => {
        process.on('exit', () => {
            logger.warn('WARNING! Non-one exit code!');
            process.kill(process.pid);
        });
        process.exit(1);
    });
};
process.on('uncaughtException', errorHandler);
process.on('unhandledRejection', errorHandler);
function bindOnExitHandler(handler, unshift = false) {
    list.add(new ListNode(handler), unshift);
    if (!onSignalHandler) {
        initListeners();
    }
}
exports.bindOnExitHandler = bindOnExitHandler;
function unbindOnExitHandler(handler) {
    list.remove(handler);
    if (list.length === 0) {
        removeListeners();
    }
}
exports.unbindOnExitHandler = unbindOnExitHandler;
function exitGracefully(exitCode) {
    if (onSignalHandler) {
        onSignalHandler('SIGQUIT', exitCode);
    }
    else {
        process.exit(exitCode);
    }
}
exports.exitGracefully = exitGracefully;
function enableExitTimeout() {
    if (!timeoutEnabled) {
        logger.info(`${exitTimeout} ms before exiting...`);
        setExitTimeout();
        timeoutEnabled = true;
    }
}
exports.enableExitTimeout = enableExitTimeout;
function disableExitTimeout() {
    if (timeoutEnabled) {
        logger.info('The process can take a minute to exit. Please, stand by.');
        resetExitTimeout();
        timeoutEnabled = false;
    }
}
exports.disableExitTimeout = disableExitTimeout;
function initListeners() {
    onSignalHandler = (signal, exitCode = 0) => {
        execHandlers().catch((err) => {
            logger.error(err);
            process.exit(1);
        }).then(() => {
            process.exit(exitCode);
        });
    };
    process.on('SIGINT', onSignalHandler);
    process.on('SIGTERM', onSignalHandler);
    process.on('SIGQUIT', onSignalHandler);
    process.on('SIGHUP', onSignalHandler);
    process.on('SIGBREAK', onSignalHandler);
}
function removeListeners() {
    if (onSignalHandler) {
        process.off('SIGINT', onSignalHandler);
        process.off('SIGTERM', onSignalHandler);
        process.off('SIGQUIT', onSignalHandler);
        process.off('SIGHUP', onSignalHandler);
        process.off('SIGBREAK', onSignalHandler);
    }
    onSignalHandler = null;
}
let timeoutEnabled = true;
let timeout = null;
async function execHandlers() {
    if (handled) {
        logger.info('Process exit handlers are being executed. Waiting...');
        return;
    }
    handled = true;
    if (list.length > 0) {
        logger.info('The process is running exit handlers...');
        if (timeoutEnabled) {
            setExitTimeout();
        }
        for (const handler of list) {
            await handler();
        }
        resetExitTimeout();
    }
}
function setExitTimeout() {
    timeout = setTimeout(() => {
        logger.error('The process exited due to too long wait for exit handlers!');
        process.exit(1);
    }, exitTimeout);
}
function resetExitTimeout() {
    if (timeout) {
        clearTimeout(timeout);
        timeout = null;
    }
}
//# sourceMappingURL=exit-handler.service.js.map