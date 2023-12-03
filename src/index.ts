import { Buffer } from "buffer";
import { EventEmitter as Events } from "events";
import * as net from "net";

import { Readable } from "stream";
const Serializer = require("xmlrpc/lib/serializer");
const Deserializer = require("xmlrpc/lib/deserializer");
const { fromEvent } = require("promise-toolbox");

export class GbxClient extends Events {
    host: string;
    port: number;
    isConnected: boolean;
    doHandShake: boolean;
    reqHandle: number;
    private socket: net.Socket | null;
    recvData: Buffer;
    responseLength: null | number;
    requestHandle: number;
    dataPointer: number;

    /**
    * Creates an instance of GbxClient.
    * @memberof GbxClient
    */
    public constructor() {
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
    async connect(host?: string, port?: number): Promise<Boolean> {
        this.host = host || "127.0.0.1";
        this.port = port || 5000;
        this.socket = net.connect(this.port, this.host);
        this.socket.setKeepAlive(true);
        this.socket.on("error", (error) => {
            console.error("Client socket error:", error.message);
            console.error("Retrying connection in 5 seconds.");
            this.socket?.destroy();
            this.isConnected = false;
            setTimeout(() => {
                this.tryReconnect();
            }, 5000);
        });
        this.socket.on("end", () => {
            this.isConnected = false;
            this.socket?.destroy();
            this.emit("disconnect");
            this.socket = null;
        });
        this.socket?.on("data", (data) => {
            this.handleData(data);
        });
        return await fromEvent(this, "connect");
    }

    private tryReconnect() {
        this.connect(this.host, this.port);
    }

    private handleData(data: Buffer): void {
        this.recvData = Buffer.concat([this.recvData, data]);
        if (this.recvData.length > 0 && this.responseLength == null) {
            this.responseLength = this.recvData.readUInt32LE();
            if (this.isConnected) this.responseLength += 4;
            this.recvData = this.recvData.subarray(4);
        }
        if (this.responseLength && this.recvData.length >= this.responseLength) {
            let data = this.recvData.subarray(0, this.responseLength);
            if (this.recvData.length > this.responseLength) {
                this.recvData = this.recvData.subarray(this.responseLength);
            } else {
                this.recvData = Buffer.alloc(0);
            }
            if (!this.isConnected) {
                if (data.toString('utf-8') == "GBXRemote 2") {
                    this.isConnected = true;
                    setImmediate(() => this.emit("connect", true));
                } else {
                    this.socket?.destroy();
                    this.isConnected = false;
                    this.socket = null;
                    setImmediate(() => this.emit("connect", false));
                    this.emit("disconnect");
                }
            } else {
                const deserializer = new Deserializer();
                this.requestHandle = data.readUInt32LE();                
                if (this.requestHandle > 0x80000000) {
                    deserializer.deserializeMethodResponse(
                        Readable.from(data.subarray(4)),
                        (err: any, res: any) => {
                            this.emit(`response:${this.requestHandle}`, [res, err]);
                        }
                    );
                } else {
                    deserializer.deserializeMethodCall(
                        Readable.from(data.subarray(4)),
                        (err: any, method: any, res: any) => {
                            this.emit("callback", method, res);
                            this.emit(method, res);
                        }
                    );
                }
            }
            this.responseLength = null;
            this.handleData(Buffer.alloc(0));
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
    async call(method: string, ...params: any) {
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
    async callScript(method: string, ...params: any) {
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
    async multicall(methods: Array<any>) {
        const params: any = [];
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

    private async query(xml: string) {
        // if request is more than 4mb
        if (xml.length + 8 > 4 * 1024 * 1024) {
            throw new Error(
                "transport error - request too large (" + xml.length + ")"
            );
        }
        this.reqHandle++;
        if (this.reqHandle >= 0xffffff00) this.reqHandle = 0x80000000;

        const len = Buffer.byteLength(xml);
        const buf = Buffer.alloc(8 + len);
        buf.writeInt32LE(len, 0);
        buf.writeUInt32LE(this.reqHandle, 4);
        buf.write(xml, 8);
        this.socket?.write(buf, "utf8");
        const response = await fromEvent(this, `response:${this.reqHandle}`);

        if (response[1]) {
            throw new Error(response[1].message);
        }

        return response[0];
    }

    /**
    * Disconnect
    *
    * @returns Promise<true>
    * @memberof GbxClient
    */
    async disconnect(): Promise<true> {
        this.socket?.destroy();
        this.isConnected = false;
        this.emit("disconnect");
        return true;
    }
}
