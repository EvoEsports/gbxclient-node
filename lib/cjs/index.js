"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.GbxClient = void 0;
const events_1 = require("events");
const net = __importStar(require("net"));
const stream_1 = require("stream");
const Serializer = require("xmlrpc/lib/serializer");
const Deserializer = require("xmlrpc/lib/deserializer");
const { fromEvent } = require("promise-toolbox");
class GbxClient extends events_1.EventEmitter {
    /**
     * Creates an instance of GbxClient.
     * @memberof GbxClient
     */
    constructor() {
        super();
        this.isConnected = false;
        this.reqHandle = 0x80000000;
        this.host = "";
        this.port = 5000;
        this.socket = null;
        this.recvData = null;
        this.responseLength = null;
        this.requestHandle = 0;
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
        this.setupListeners();
        return await fromEvent(this, "connect");
    }
    setupListeners() {
        var _a, _b;
        (_a = this.socket) === null || _a === void 0 ? void 0 : _a.on("end", () => {
            this.isConnected = false;
            this.emit("connect", false);
        });
        (_b = this.socket) === null || _b === void 0 ? void 0 : _b.on("data", (data) => {
            var _a;
            if (this.isConnected === false) {
                const headerSize = data.readUIntLE(0, 4);
                const header = data.slice(4).toString("utf-8");
                if (header.length !== headerSize && header !== "GBXRemote 2") {
                    (_a = this.socket) === null || _a === void 0 ? void 0 : _a.destroy();
                    this.isConnected = false;
                    this.socket = null;
                    this.emit("connect", false);
                }
                this.isConnected = true;
                this.emit("connect", true);
                return;
            }
            if (this.responseLength == null && this.recvData == null) {
                this.responseLength = data.readUInt32LE(0);
                this.requestHandle = data.readUInt32LE(4);
                this.recvData = data.slice(8);
            }
            else if (this.recvData !== null) {
                this.recvData = Buffer.concat([this.recvData, data]);
            }
            if (this.responseLength && this.recvData != null && this.recvData.length >= this.responseLength) {
                const response = this.recvData;
                this.recvData = null;
                this.responseLength = null;
                const deserializer = new Deserializer();
                if (this.requestHandle > 0x80000000) {
                    deserializer.deserializeMethodResponse(stream_1.Readable.from(response), (err, res) => {
                        this.emit(`response:${this.requestHandle}`, [res, err]);
                    });
                }
                else {
                    deserializer.deserializeMethodCall(stream_1.Readable.from(response), (err, method, res) => {
                        this.emit("callback", method, res);
                        this.emit(method, res);
                    });
                }
            }
        });
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
        const xml = Serializer.serializeMethodCall(method, params);
        return await this.query(xml);
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
        const params = [];
        for (let method of methods) {
            params.push({ methodName: method.shift(), params: method });
        }
        const xml = Serializer.serializeMethodCall("system.multicall", [params]);
        const out = [];
        for (let answer of await this.query(xml)) {
            out.push(answer[0]);
        }
        return out;
    }
    async query(xml) {
        var _a;
        // if request is more than 4mb
        if (xml.length + 8 > 4 * 1024 * 1024) {
            throw new Error("transport error - request too large (" + xml.length + ")");
        }
        this.reqHandle++;
        if (this.reqHandle >= 0xffffff00)
            this.reqHandle = 0x80000000;
        const len = Buffer.byteLength(xml);
        const buf = Buffer.alloc(8 + len);
        buf.writeInt32LE(len, 0);
        buf.writeUInt32LE(this.reqHandle, 4);
        buf.write(xml, 8);
        (_a = this.socket) === null || _a === void 0 ? void 0 : _a.write(buf, "utf8");
        const response = await fromEvent(this, `response:${this.reqHandle}`);
        if (response[1]) {
            throw response[1];
        }
        return response[0];
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
        this.emit("connect", false);
        return true;
    }
}
exports.GbxClient = GbxClient;
