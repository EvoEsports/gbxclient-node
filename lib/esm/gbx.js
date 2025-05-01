var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Buffer } from "node:buffer";
import { Socket } from "net";
import { Readable } from "stream";
/** @ts-ignore */
import Serializer from "xmlrpc/lib/serializer";
/** @ts-ignore */
import Deserializer from "xmlrpc/lib/deserializer";
export class Gbx {
    /**
     * Creates an instance of GbxClient.
     * @memberof GbxClient
     */
    constructor(server, options = {}) {
        this.options = {
            showErrors: false,
            throwErrors: true,
        };
        this.promiseCallbacks = {};
        this.game = "Trackmania";
        this.isConnected = false;
        this.reqHandle = 0x80000000;
        this.socket = null;
        this.recvData = Buffer.from([]);
        this.responseLength = null;
        this.requestHandle = 0;
        this.dataPointer = 0;
        this.doHandShake = false;
        this.server = server;
        this.options = Object.assign(Object.assign({}, this.options), options);
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
            host = host || "127.0.0.1";
            port = port || 5000;
            const socket = new Socket();
            // increase max listeners to avoid warnings
            socket.setMaxListeners(30);
            const timeout = 5000;
            this.socket = socket;
            socket.connect({
                host: host,
                port: port,
                keepAlive: true,
                family: 4,
            }, () => {
                socket.on("connect", () => {
                    if (this.timeoutHandler) {
                        clearTimeout(this.timeoutHandler);
                        this.timeoutHandler = null;
                    }
                });
                socket.on("end", () => {
                    this.isConnected = false;
                    this.server.onDisconnect("end");
                });
                socket.on("error", (error) => {
                    this.isConnected = false;
                    this.server.onDisconnect(error.message);
                });
                socket.on("data", (data) => __awaiter(this, void 0, void 0, function* () {
                    if (this.timeoutHandler) {
                        clearTimeout(this.timeoutHandler);
                        this.timeoutHandler = null;
                    }
                    this.handleData(data);
                }));
                socket.on("timeout", () => {
                    console.error("XMLRPC Connection timeout");
                    process.exit(1);
                });
            });
            this.timeoutHandler = setTimeout(() => {
                var _a;
                console.error("[ERROR] Attempt at connection exceeded timeout value.");
                socket.end();
                (_a = this.promiseCallbacks["onConnect"]) === null || _a === void 0 ? void 0 : _a.reject(new Error("Connection timeout"));
                delete this.promiseCallbacks["onConnect"];
            }, timeout);
            const res = yield new Promise((resolve, reject) => {
                this.promiseCallbacks["onConnect"] = { resolve, reject };
            });
            delete this.promiseCallbacks["onConnect"];
            return res;
        });
    }
    handleData(data) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            // Append new data if available.
            if (data) {
                this.recvData = Buffer.concat([this.recvData, data]);
            }
            // Process all complete messages present in recvData.
            while (true) {
                // If we haven't read the header yet, do so.
                if (this.responseLength === null) {
                    // Need at least 4 bytes for the header.
                    if (this.recvData.length < 4)
                        break;
                    this.responseLength = this.recvData.readUInt32LE(0);
                    if (this.isConnected)
                        this.responseLength += 4;
                    this.recvData = this.recvData.subarray(4);
                }
                // Wait until the full message is available.
                if (this.responseLength &&
                    this.recvData.length >= this.responseLength) {
                    const message = this.recvData.subarray(0, this.responseLength);
                    this.recvData = this.recvData.subarray(this.responseLength);
                    // Reset state for the next message.
                    this.responseLength = null;
                    // Processing handshake response.
                    if (!this.isConnected) {
                        const msgStr = message.toString("utf-8");
                        if (msgStr === "GBXRemote 2") {
                            this.isConnected = true;
                            const handshakeCb = this.promiseCallbacks["onConnect"];
                            handshakeCb === null || handshakeCb === void 0 ? void 0 : handshakeCb.resolve(true);
                        }
                        else {
                            (_a = this.socket) === null || _a === void 0 ? void 0 : _a.destroy();
                            this.isConnected = false;
                            this.socket = null;
                            const handshakeCb = this.promiseCallbacks["onConnect"];
                            handshakeCb === null || handshakeCb === void 0 ? void 0 : handshakeCb.reject(new Error("Unknown protocol: " + msgStr));
                            this.server.onDisconnect("Unknown protocol: " + msgStr);
                        }
                    }
                    else {
                        // Processing regular messages.
                        const deserializer = new Deserializer("utf-8");
                        // The first 4 bytes in the message represent the request handle.
                        const requestHandle = message.readUInt32LE(0);
                        const readable = Readable.from(message.subarray(4));
                        if (requestHandle >= 0x80000000) {
                            const cb = this.promiseCallbacks[requestHandle];
                            if (cb) {
                                deserializer.deserializeMethodResponse(readable, (err, res) => __awaiter(this, void 0, void 0, function* () {
                                    cb.resolve([res, err]);
                                    delete this.promiseCallbacks[requestHandle];
                                }));
                            }
                        }
                        else {
                            deserializer.deserializeMethodCall(readable, (err, method, res) => __awaiter(this, void 0, void 0, function* () {
                                if (err && this.options.showErrors) {
                                    console.error(err);
                                }
                                else {
                                    this.server
                                        .onCallback(method, res)
                                        .catch((err) => {
                                        if (this.options.showErrors) {
                                            console.error("[ERROR] gbxclient > " +
                                                err.message);
                                        }
                                        if (this.options.throwErrors) {
                                            throw new Error(err);
                                        }
                                    });
                                }
                            }));
                        }
                    }
                }
                else {
                    // Not enough data for a full message, exit the loop.
                    break;
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
        const xml = Serializer.serializeMethodCall(method, params);
        return this.query(xml, false).catch((err) => {
            console.error(`[ERROR] gbxclient > ${err.message}`);
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
            if (!this.isConnected) {
                return undefined;
            }
            return yield this.call("TriggerModeScriptEventArray", method, params);
        });
    }
    /**
     * perform a multicall
     *
     * @example
     * await gbx.multicall([
     *                     ["Method1", param1, param2, ...],
     *                     ["Method2", param1, param2, ...],
     *                     ])
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
            const xml = Serializer.serializeMethodCall("system.multicall", [
                params,
            ]);
            const out = [];
            for (let answer of yield this.query(xml, true)) {
                out.push(answer[0]);
            }
            return out;
        });
    }
    /**
     * perform a multisend
     *
     * @example
     * await gbx.multicall([
     *                     ["Method1", param1, param2, ...],
     *                     ["Method2", param1, param2, ...],
     *                     ])
     *
     * @param {Array<any>} methods
     * @returns Array<any>
     * @memberof GbxClient
     */
    multisend(methods) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isConnected) {
                return undefined;
            }
            const params = [];
            for (let method of methods) {
                params.push({ methodName: method.shift(), params: method });
            }
            const xml = Serializer.serializeMethodCall("system.multicall", [
                params,
            ]);
            yield this.query(xml, false);
        });
    }
    query(xml_1) {
        return __awaiter(this, arguments, void 0, function* (xml, wait = true) {
            const HEADER_LENGTH = 8;
            const requestSize = xml.length + HEADER_LENGTH;
            // Define request size limits per game
            const limits = {
                Trackmania: 7 * 1024 * 1024,
                TmForever: 1 * 1024 * 1024,
                ManiaPlanet: 4 * 1024 * 1024,
            };
            const limit = limits[this.game];
            if (limit && requestSize > limit) {
                throw new Error(`transport error - request too large (${(xml.length / 1024).toFixed(2)} Kb)`);
            }
            // Increment and wrap request handle if needed
            this.reqHandle++;
            if (this.reqHandle >= 0xffffff00) {
                this.reqHandle = 0x80000000;
            }
            const handle = this.reqHandle;
            // Allocate buffer and write header and XML payload
            const len = Buffer.byteLength(xml, "utf-8");
            const buf = Buffer.alloc(HEADER_LENGTH + len);
            buf.writeInt32LE(len, 0); // write length at offset 0
            buf.writeUInt32LE(handle, 4); // write request handle at offset 4
            buf.write(xml, HEADER_LENGTH, "utf-8"); // write xml starting at offset 8
            // Write buffer to the socket
            yield new Promise((resolve, reject) => {
                var _a, _b;
                if (!((_a = this.socket) === null || _a === void 0 ? void 0 : _a.write(buf, (err) => {
                    if (err)
                        reject(err);
                }))) {
                    (_b = this.socket) === null || _b === void 0 ? void 0 : _b.once("drain", resolve);
                }
                else {
                    process.nextTick(resolve);
                }
            });
            // If not waiting for a response, return an empty object.
            if (!wait) {
                this.promiseCallbacks[handle] = {
                    resolve: () => { },
                    reject: () => { },
                };
                return {};
            }
            // Wait for and retrieve the response
            const response = yield new Promise((resolve, reject) => {
                this.promiseCallbacks[handle] = { resolve, reject };
            });
            delete this.promiseCallbacks[handle];
            // Error handling of response if needed.
            if (response[1]) {
                if (this.options.showErrors) {
                    console.error(response[1].faultString
                        ? `[ERROR] gbxclient > ${response[1].faultString}`
                        : response[1]);
                }
                if (this.options.throwErrors) {
                    throw response[1];
                }
                return undefined;
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
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            (_a = this.socket) === null || _a === void 0 ? void 0 : _a.destroy();
            this.isConnected = false;
            this.server.onDisconnect("disconnect");
            return true;
        });
    }
}
