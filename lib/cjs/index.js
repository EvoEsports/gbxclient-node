"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GbxClient = void 0;
const gbx_1 = require("./gbx");
const node_events_1 = __importDefault(require("node:events"));
class GbxClient {
    /** @ignore */
    constructor(options) {
        /** @ignore */
        this.events = new node_events_1.default();
        this.events.setMaxListeners(100);
        this.gbx = new gbx_1.Gbx(this, options);
    }
    onDisconnect(str) {
        this.events.emit("disconnect", str);
    }
    async onCallback(method, data) {
        this.events.emit("callback", method, data);
        this.events.emit(method, data);
    }
    /**
     * Send request and wait for response
     * @param method
     * @param args
     * @returns
     */
    async call(method, ...args) {
        return this.gbx.call(method, ...args);
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
    async callScript(method, ...args) {
        return this.gbx.callScript(method, ...args);
    }
    /** perform multicall */
    async multicall(methods) {
        try {
            return this.gbx.multicall(methods);
        }
        catch (e) {
            console.error(e.message);
            return undefined;
        }
    }
    /** perform multicall */
    async multisend(methods) {
        try {
            return this.gbx.multisend(methods);
        }
        catch (e) {
            console.error(e.message);
            return undefined;
        }
    }
    /**
     * connect to server
     * @param host
     * @param port
     */
    async connect(host, port) {
        try {
            const answer = this.gbx.connect(host, port);
            this.events.emit("connect", true);
            return answer;
        }
        catch (e) {
            console.error(e.message);
        }
        return false;
    }
    async disconnect() {
        try {
            return this.gbx.disconnect();
        }
        catch (e) {
            console.error(e.message);
        }
        return false;
    }
}
exports.GbxClient = GbxClient;
