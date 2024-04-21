"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GbxClient = void 0;
const buffer_1 = require("buffer");
const events_1 = require("events");
const net = __importStar(require("net"));
const stream_1 = require("stream");
// @ts-ignore
const serializer_1 = __importDefault(require("xmlrpc/lib/serializer"));
// @ts-ignore
const deserializer_1 = __importDefault(require("xmlrpc/lib/deserializer"));
class GbxClient extends events_1.EventEmitter {
    /**
    * Creates an instance of GbxClient.
    * @memberof GbxClient
    */
    constructor(options = { showErrors: false, throwErrors: true }) {
        super();
        this.promiseCallbacks = {};
        this.isConnected = false;
        this.reqHandle = 0x80000000;
        this.host = "";
        this.port = 5000;
        this.socket = null;
        this.recvData = buffer_1.Buffer.from([]);
        this.responseLength = null;
        this.requestHandle = 0;
        this.dataPointer = 0;
        this.doHandShake = false;
        this.options = options;
    }
    /**
    * Connects to trackmania server
    * Supports currently Trackmanias with GBXRemote 2 protocol:
    * Trackmania Nations Forever / Maniaplanet / Trackmania 2020
    *
    * @param {string} [host]
    * @param {number} [port]
    * @returns {Promise<boolean>}
    * @memberof GbxClient
    */
    async connect(host, port) {
        this.host = host || "127.0.0.1";
        this.port = port || 5000;
        this.socket = net.connect(this.port, this.host);
        this.socket.setKeepAlive(true);
        this.socket.on("error", (error) => {
            var _a;
            (_a = this.socket) === null || _a === void 0 ? void 0 : _a.destroy();
            this.socket = null;
            this.isConnected = false;
            this.emit("disconnect", error.message);
            this.emit("connect", false);
        });
        this.socket.on("end", () => {
            var _a;
            this.isConnected = false;
            (_a = this.socket) === null || _a === void 0 ? void 0 : _a.destroy();
            this.emit("disconnect", "Connection closed.");
            this.emit("connect", false);
            this.socket = null;
        });
        this.socket.on("data", (data) => {
            this.handleData(data);
        });
        const res = await new Promise((resolve, reject) => {
            this.promiseCallbacks['onConnect'] = { resolve, reject };
        });
        delete this.promiseCallbacks['onConnect'];
        return res;
    }
    handleData(data) {
        var _a, _b, _c;
        this.recvData = buffer_1.Buffer.concat([this.recvData, data]);
        if (this.recvData.length > 0 && this.responseLength == null) {
            this.responseLength = this.recvData.readUInt32LE();
            if (this.isConnected)
                this.responseLength += 4;
            this.recvData = this.recvData.subarray(4);
        }
        if (this.responseLength && this.recvData.length >= this.responseLength) {
            let data = this.recvData.subarray(0, this.responseLength);
            if (this.recvData.length > this.responseLength) {
                this.recvData = this.recvData.subarray(this.responseLength);
            }
            else {
                this.recvData = buffer_1.Buffer.from([]);
            }
            if (!this.isConnected) {
                if (data.toString('utf-8') == "GBXRemote 2") {
                    this.isConnected = true;
                    (_a = this.promiseCallbacks['onConnect']) === null || _a === void 0 ? void 0 : _a.resolve(true);
                }
                else {
                    (_b = this.socket) === null || _b === void 0 ? void 0 : _b.destroy();
                    this.isConnected = false;
                    this.socket = null;
                    (_c = this.promiseCallbacks['onConnect']) === null || _c === void 0 ? void 0 : _c.reject(false);
                    this.emit("disconnect", "GBXRemote 2 protocol not supported");
                }
            }
            else {
                const deserializer = new deserializer_1.default("utf-8");
                const requestHandle = data.readUInt32LE();
                const readable = stream_1.Readable.from(data.subarray(4));
                if (requestHandle >= 0x80000000) {
                    deserializer.deserializeMethodResponse(readable, (err, res) => {
                        if (this.promiseCallbacks[requestHandle]) {
                            this.promiseCallbacks[requestHandle].resolve([res, err]);
                        }
                    });
                }
                else {
                    deserializer.deserializeMethodCall(readable, (err, method, res) => {
                        if (err) {
                            if (this.options.showErrors)
                                console.error(err);
                        }
                        else {
                            this.emit("callback", method, res);
                            this.emit(method, res);
                        }
                    });
                }
            }
            this.responseLength = null;
            if (this.recvData.length > 0)
                return this.handleData(buffer_1.Buffer.alloc(0));
            return;
        }
        return;
    }
    /**
    * execute a xmlrpc method call on a server
    *
    * @param {string} method
    * @param {...any} params
    * @returns any
    * @memberof GbxClient
    */
    async call(method, ...params) {
        if (!this.isConnected) {
            return undefined;
        }
        try {
            const xml = serializer_1.default.serializeMethodCall(method, params);
            return await this.query(xml, true);
        }
        catch (err) {
            if (this.options.showErrors) {
                console.error("[ERROR] gbxclient >" + err.message);
            }
            if (this.options.throwErrors) {
                throw new Error(err);
            }
            return undefined;
        }
    }
    /**
    * execute a xmlrpc method call on a server
    *
    * @param {string} method
    * @param {...any} params
    * @returns any
    * @memberof GbxClient
    */
    send(method, ...params) {
        if (!this.isConnected) {
            return undefined;
        }
        try {
            const xml = serializer_1.default.serializeMethodCall(method, params);
            return this.query(xml, false);
        }
        catch (err) {
            if (this.options.showErrors) {
                console.error("[ERROR] gbxclient >" + err.message);
            }
            if (this.options.throwErrors) {
                throw new Error(err.message);
            }
            return undefined;
        }
    }
    /**
    * execute a script method call
    *
    * @param {string} method
    * @param {...any} params
    * @returns any
    * @memberof GbxClient
    */
    async callScript(method, ...params) {
        if (!this.isConnected) {
            return undefined;
        }
        return await this.call("TriggerModeScriptEventArray", method, params);
    }
    /**
    * perform a multicall
    *
    * @example await gbx.multicall([
    *                              ["Method1", param1, param2, ...],
    *                              ["Method2", param1, param2, ...],
    *                              ...
    *                              ])
    *
    * @param {Array<any>} methods
    * @returns Array<any>
    * @memberof GbxClient
    */
    async multicall(methods) {
        if (!this.isConnected) {
            return undefined;
        }
        const params = [];
        for (let method of methods) {
            params.push({ methodName: method.shift(), params: method });
        }
        const xml = serializer_1.default.serializeMethodCall("system.multicall", [params]);
        const out = [];
        for (let answer of await this.query(xml, true)) {
            out.push(answer[0]);
        }
        return out;
    }
    async query(xml, wait = true) {
        var _a;
        // if request is more than 4mb
        if (xml.length + 8 > 4 * 1024 * 1024) {
            throw new Error("transport error - request too large (" + xml.length + ")");
        }
        this.reqHandle++;
        if (this.reqHandle >= 0xffffff00)
            this.reqHandle = 0x80000000;
        const handle = this.reqHandle;
        const len = buffer_1.Buffer.byteLength(xml);
        const buf = buffer_1.Buffer.alloc(8 + len);
        buf.writeInt32LE(len, 0);
        buf.writeUInt32LE(handle, 4);
        buf.write(xml, 8);
        (_a = this.socket) === null || _a === void 0 ? void 0 : _a.write(buf);
        if (wait) {
            const response = await new Promise((resolve, reject) => {
                this.promiseCallbacks[handle] = { resolve, reject };
            });
            delete this.promiseCallbacks[handle];
            if (response[1]) {
                if (this.options.showErrors) {
                    console.error(response[1].faultString ? "[ERROR] gbxclient > " + response[1].faultString : response[1]);
                }
                if (this.options.throwErrors) {
                    throw response[1];
                }
                return undefined;
            }
            return response[0];
        }
        this.removeAllListeners(`response:${handle}`);
        return {};
    }
    /**
    * Disconnect
    *
    * @returns Promise<true>
    * @memberof GbxClient
    */
    async disconnect() {
        var _a;
        (_a = this.socket) === null || _a === void 0 ? void 0 : _a.destroy();
        this.isConnected = false;
        this.emit("disconnect");
        return true;
    }
}
exports.GbxClient = GbxClient;
