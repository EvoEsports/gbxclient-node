var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { EventEmitter as Events } from "events";
import * as net from "net";
import { Readable } from "stream";
const Serializer = require("xmlrpc/lib/serializer");
const Deserializer = require("xmlrpc/lib/deserializer");
const { fromEvent } = require("promise-toolbox");
export class GbxClient extends Events {
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
        this.dataPointer = 0;
        this.doHandShake = false;
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
    connect(host, port) {
        var _a;
        this.host = host || "127.0.0.1";
        this.port = port || 5000;
        this.socket = net.connect(this.port, this.host);
        this.socket.setKeepAlive(true);
        this.socket.on("error", (error) => {
            var _a;
            console.error("Client socket error:", error.message);
            console.error("Retrying connection in 5 seconds.");
            (_a = this.socket) === null || _a === void 0 ? void 0 : _a.destroy();
            this.isConnected = false;
            setTimeout(() => {
                this.tryReconnect();
            }, 5000);
        });
        this.socket.on("end", () => {
            var _a;
            this.isConnected = false;
            (_a = this.socket) === null || _a === void 0 ? void 0 : _a.destroy();
            this.emit("disconnect");
            this.socket = null;
        });
        let partial = false;
        (_a = this.socket) === null || _a === void 0 ? void 0 : _a.on("data", (data) => {
            var _a;
            if (!this.isConnected) {
                const headerSize = data.readUIntLE(0, 4);
                let header = data.slice(4).toString("utf-8");
                if (partial == false && headerSize == 11 && header === '') {
                    partial = true;
                    return;
                }
                if (partial)
                    header = data.toString("utf-8");
                if (header == "GBXRemote 2") {
                    this.isConnected = true;
                    setImmediate(() => this.emit("connect"));
                    return;
                }
                (_a = this.socket) === null || _a === void 0 ? void 0 : _a.destroy();
                this.isConnected = false;
                this.socket = null;
                this.emit("disconnect");
                return;
            }
            else {
                this.extractAndHandle(data);
            }
        });
    }
    tryReconnect() {
        this.connect(this.host, this.port);
    }
    extractAndHandle(data) {
        this.dataPointer = 0;
        do {
            if (this.responseLength == null && this.recvData == null) {
                this.responseLength = data.readUInt32LE(this.dataPointer);
                this.requestHandle = data.readUInt32LE(this.dataPointer + 4);
                const endOfMessage = this.dataPointer + 8 + this.responseLength;
                this.recvData = data.slice(this.dataPointer, endOfMessage);
                this.dataPointer = endOfMessage;
            }
            else if (this.recvData !== null) {
                const backup = this.recvData;
                this.recvData = null;
                this.responseLength = null;
                return this.extractAndHandle(Buffer.concat([backup, data]));
            }
            if (this.responseLength &&
                this.recvData != null &&
                this.recvData.length >= this.responseLength + 8) {
                const response = this.recvData.slice(8);
                this.recvData = null;
                this.responseLength = null;
                const deserializer = new Deserializer();
                if (this.requestHandle > 0x80000000) {
                    deserializer.deserializeMethodResponse(Readable.from(response), (err, res) => {
                        this.emit(`response:${this.requestHandle}`, [res, err]);
                    });
                }
                else {
                    deserializer.deserializeMethodCall(Readable.from(response), (err, method, res) => {
                        this.emit("callback", method, res);
                        this.emit(method, res);
                    });
                }
            }
        } while (this.dataPointer < data.length);
    }
    /**
    * execute a xmlrpc method call on a server
    *
    * @param {string} method
    * @param {...any} params
    * @returns any
    * @memberof GbxClient
    */
    call(method, ...params) {
        return __awaiter(this, void 0, void 0, function* () {
            const xml = Serializer.serializeMethodCall(method, params);
            return yield this.query(xml);
        });
    }
    /**
    * execute a script method call
    *
    * @param {string} method
    * @param {...any} params
    * @returns any
    * @memberof GbxClient
    */
    callScript(method, ...params) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.call("TriggerModeScriptEventArray", method, params);
        });
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
    multicall(methods) {
        return __awaiter(this, void 0, void 0, function* () {
            const params = [];
            for (let method of methods) {
                params.push({ methodName: method.shift(), params: method });
            }
            const xml = Serializer.serializeMethodCall("system.multicall", [params]);
            const out = [];
            for (let answer of yield this.query(xml)) {
                out.push(answer[0]);
            }
            return out;
        });
    }
    query(xml) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
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
            const response = yield fromEvent(this, `response:${this.reqHandle}`);
            if (response[1]) {
                throw response[1];
            }
            return response[0];
        });
    }
    /**
    * Disconnect
    *
    * @returns Promise<true>
    * @memberof GbxClient
    */
    disconnect() {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            (_a = this.socket) === null || _a === void 0 ? void 0 : _a.destroy();
            this.isConnected = false;
            this.emit("disconnect");
            return true;
        });
    }
}
