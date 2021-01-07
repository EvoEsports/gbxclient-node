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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GbxClient = void 0;
const events_1 = require("events");
const net = __importStar(require("net"));
const event_to_promise_1 = __importDefault(require("event-to-promise"));
const stream_1 = require("stream");
const Serializer = require("xmlrpc/lib/serializer");
const Deserializer = require("xmlrpc/lib/deserializer");
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
    }
    /**
     * Connects to trackmania server
     * supports currently trackamanias with GBXRemote 2 protocol:
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
        this.setupListeners();
        return await event_to_promise_1.default(this, "connect");
    }
    setupListeners() {
        var _a;
        (_a = this.socket) === null || _a === void 0 ? void 0 : _a.on("data", (data) => {
            var _a;
            // first datas, handshake
            if (this.isConnected == false) {
                let headerSize = data.readUIntLE(0, 4);
                let header = data.slice(4).toString();
                if (header.length !== headerSize && header !== "GBXRemote 2") {
                    (_a = this.socket) === null || _a === void 0 ? void 0 : _a.end();
                    console.log("handshake mismatch");
                    this.emit("connect", false);
                    process.exit(0);
                }
                this.isConnected = true;
                this.emit("connect", true);
                return;
            }
            let responseLength = data.readUInt32LE(0);
            let requestHandle = data.readUInt32LE(4);
            let response = data.slice(8).toString();
            // console.log(responseLength, requestHandle, response);
            let deserializer = new Deserializer();
            if (requestHandle > 0x80000000) {
                deserializer.deserializeMethodResponse(stream_1.Readable.from(response), (err, res) => {
                    this.emit(`response:${requestHandle}`, [res, err]);
                });
            }
            else {
                deserializer.deserializeMethodCall(stream_1.Readable.from(response), (err, method, res) => {
                    this.emit("callback", method, res);
                    this.emit(method, res);
                });
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
        let xml = Serializer.serializeMethodCall(method, params);
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
        let params = [];
        for (let method of methods) {
            params.push({ methodName: method.shift(), params: method });
        }
        let xml = Serializer.serializeMethodCall("system.multicall", [params]);
        let out = [];
        for (let answer of await this.query(xml)) {
            out.push(answer[0]);
        }
        return out;
    }
    async query(xml) {
        var _a;
        // if request is more than 4mb
        if (xml.length + 8 > 4 * 1024 * 1024) {
            return new Error("transport error - request too large (" + xml.length + ")");
        }
        this.reqHandle++;
        let len = Buffer.byteLength(xml);
        let buf = Buffer.alloc(8 + len);
        buf.writeInt32LE(len, 0);
        buf.writeUInt32LE(this.reqHandle, 4);
        buf.write(xml, 8);
        (_a = this.socket) === null || _a === void 0 ? void 0 : _a.write(buf, "utf8");
        let response = await event_to_promise_1.default(this, `response:${this.reqHandle}`);
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
        (_a = this.socket) === null || _a === void 0 ? void 0 : _a.end();
        this.isConnected = false;
        return true;
    }
}
exports.GbxClient = GbxClient;
