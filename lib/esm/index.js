var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Gbx } from "./gbx";
import EventEmitter from "node:events";
export class GbxClient {
    /** @ignore */
    constructor(options) {
        /** @ignore */
        this.events = new EventEmitter();
        this.events.setMaxListeners(100);
        this.gbx = new Gbx(this, options);
    }
    onDisconnect(str) {
        this.events.emit("disconnect", str);
    }
    onCallback(method, data) {
        return __awaiter(this, void 0, void 0, function* () {
            this.events.emit("callback", method, data);
            this.events.emit(method, data);
        });
    }
    /**
     * Send request and wait for response
     * @param method
     * @param args
     * @returns
     */
    call(method, ...args) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.gbx.call(method, ...args);
        });
    }
    addListener(method, callback, obj = undefined) {
        const wrapper = callback.bind(obj);
        wrapper.listener = callback;
        this.events.addListener(method, wrapper);
    }
    on(method, callback, obj = undefined) {
        const wrapper = callback.bind(obj);
        wrapper.listener = callback;
        this.events.addListener(method, wrapper);
    }
    prependListener(method, callback, obj = undefined) {
        const wrapper = callback.bind(obj);
        wrapper.listener = callback;
        this.events.prependListener(method, wrapper);
    }
    removeListener(method, callback) {
        this.events.removeListener(method, callback);
    }
    emit(method, ...args) {
        this.events.emit(method, ...args);
    }
    /**
     * send request and ignore everything
     * @param method
     * @param args
     * @returns
     */
    send(method, ...args) {
        try {
            return this.gbx.send(method, ...args);
        }
        catch (e) {
            console.error(e.message);
            return undefined;
        }
    }
    /**
     * call script method
     * @param method
     * @param args
     * @returns
     */
    callScript(method, ...args) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.gbx.callScript(method, ...args);
        });
    }
    /** perform multicall */
    multicall(methods) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.gbx.multicall(methods);
            }
            catch (e) {
                console.error(e.message);
                return undefined;
            }
        });
    }
    /** perform multicall */
    multisend(methods) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.gbx.multisend(methods);
            }
            catch (e) {
                console.error(e.message);
                return undefined;
            }
        });
    }
    /**
     * connect to server
     * @param host
     * @param port
     */
    connect(host, port) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const answer = this.gbx.connect(host, port);
                this.events.emit("connect", true);
                return answer;
            }
            catch (e) {
                console.error(e.message);
            }
            return false;
        });
    }
    disconnect() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.gbx.disconnect();
            }
            catch (e) {
                console.error(e.message);
            }
            return false;
        });
    }
}
