var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Buffer } from "buffer";
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
    constructor(options = { showErrors: false, throwErrors: true }) {
        super();
        this.isConnected = false;
        this.reqHandle = 0x80000000;
        this.host = "";
        this.port = 5000;
        this.socket = null;
        this.recvData = Buffer.alloc(0);
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
    connect(host, port) {
        return __awaiter(this, void 0, void 0, function* () {
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
            return yield fromEvent(this, "connect");
        });
    }
    handleData(data) {
        var _a;
        this.recvData = Buffer.concat([this.recvData, data]);
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
                this.recvData = Buffer.alloc(0);
            }
            if (!this.isConnected) {
                if (data.toString('utf-8') == "GBXRemote 2") {
                    this.isConnected = true;
                    setImmediate(() => this.emit("connect", true));
                }
                else {
                    (_a = this.socket) === null || _a === void 0 ? void 0 : _a.destroy();
                    this.isConnected = false;
                    this.socket = null;
                    setImmediate(() => this.emit("connect", false));
                    this.emit("disconnect");
                }
            }
            else {
                const deserializer = new Deserializer("utf-8");
                const requestHandle = data.readUInt32LE();
                if (requestHandle >= 0x80000000) {
                    deserializer.deserializeMethodResponse(Readable.from(data.subarray(4)), (err, res) => {
                        this.emit(`response:${requestHandle}`, [res, err]);
                    });
                }
                else {
                    deserializer.deserializeMethodCall(Readable.from(data.subarray(4)), (err, method, res) => {
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
                return this.handleData(Buffer.alloc(0));
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
    call(method, ...params) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isConnected) {
                return undefined;
            }
            try {
                const xml = Serializer.serializeMethodCall(method, params);
                return yield this.query(xml, true);
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
    send(method, ...params) {
        if (!this.isConnected) {
            return undefined;
        }
        try {
            const xml = Serializer.serializeMethodCall(method, params);
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
    callScript(method, ...params) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isConnected) {
                return undefined;
            }
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
            if (!this.isConnected) {
                return undefined;
            }
            const params = [];
            for (let method of methods) {
                params.push({ methodName: method.shift(), params: method });
            }
            const xml = Serializer.serializeMethodCall("system.multicall", [params]);
            const out = [];
            for (let answer of yield this.query(xml, true)) {
                out.push(answer[0]);
            }
            return out;
        });
    }
    query(xml, wait = true) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            // if request is more than 4mb
            if (xml.length + 8 > 4 * 1024 * 1024) {
                throw new Error("transport error - request too large (" + xml.length + ")");
            }
            this.reqHandle++;
            if (this.reqHandle >= 0xffffff00)
                this.reqHandle = 0x80000000;
            const handle = this.reqHandle;
            const len = Buffer.byteLength(xml);
            const buf = Buffer.alloc(8 + len);
            buf.writeInt32LE(len, 0);
            buf.writeUInt32LE(handle, 4);
            buf.write(xml, 8);
            (_a = this.socket) === null || _a === void 0 ? void 0 : _a.write(buf);
            if (wait) {
                const response = yield fromEvent(this, `response:${handle}`);
                this.removeAllListeners(`response:${handle}`);
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
