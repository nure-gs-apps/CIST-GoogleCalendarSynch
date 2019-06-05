"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const logger_service_1 = require("./logger.service");
class ListNode {
    constructor(handler /*, prev?: Node*/, next = null) {
        this.handler = handler;
        this.next = next;
    }
}
class List {
    get length() {
        return this._length;
    }
    constructor(head = null) {
        this.head = this.tail = head;
        this._length = head ? 1 : 0;
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
            this.tail.next = node;
        }
        this._length += 1;
    }
    remove(handler) {
        if (this._length === 0) {
            return false;
        }
        if (this.head.handler === handler) {
            this.head = this.tail = null;
            return true;
        }
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
let onSignalHandler = null;
const errorHandler = (err, p) => {
    if (p) {
        logger_service_1.logger.error('Unhandled promise rejection for ');
        logger_service_1.logger.error(p);
    }
    else {
        logger_service_1.logger.error('Unhandled exception!');
    }
    logger_service_1.logger.error(err);
    execHandlers().catch(err => {
        logger_service_1.logger.error('The process is not shut down gracefully! Error while error handling.');
        logger_service_1.logger.error(err);
    }).finally(() => {
        process.on('exit', () => {
            logger_service_1.logger.warn('WARNING! Non-one exit code!');
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
function exitGracefully() {
    if (onSignalHandler) {
        onSignalHandler('SIGQUIT');
    }
}
exports.exitGracefully = exitGracefully;
function initListeners() {
    onSignalHandler = signal => {
        execHandlers().catch((err) => {
            logger_service_1.logger.error(err);
            process.exit(1);
        }).then(() => {
            process.exit(0);
        });
    };
    process.once('SIGINT', onSignalHandler);
    process.once('SIGTERM', onSignalHandler);
    process.once('SIGQUIT', onSignalHandler);
    process.once('SIGHUP', onSignalHandler);
    process.once('SIGBREAK', onSignalHandler);
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
async function execHandlers() {
    if (list.length > 0) {
        const timeout = setTimeout(() => {
            logger_service_1.logger.error('The process exited due to too long wait for exit handlers!');
            process.exit(1);
        }, 1000);
        logger_service_1.logger.info('The process is running exit handlers...');
        for (const handler of list) {
            await handler();
        }
        clearTimeout(timeout);
    }
}
//# sourceMappingURL=exit-handler.service.js.map