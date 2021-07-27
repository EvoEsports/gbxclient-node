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
  reqHandle: number;
  private socket: net.Socket | null;
  recvData: null | Buffer;
  responseLength: null | number;
  requestHandle: number;

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
  async connect(host?: string, port?: number): Promise<boolean> {
    this.host = host || "127.0.0.1";
    this.port = port || 5000;
    this.socket = net.connect(this.port, this.host);
    this.socket.setKeepAlive(true);
    this.setupListeners();
    return await fromEvent(this, "connect");
  }

  private setupListeners() {
    this.socket?.on("end", () => {
      this.isConnected = false;
      this.emit("connect", false);
    });

    this.socket?.on("data", (data) => {
      if (this.isConnected === false) {
        const headerSize = data.readUIntLE(0, 4);
        const header = data.slice(4).toString("utf-8");
        if (header.length !== headerSize && header !== "GBXRemote 2") {
          this.socket?.destroy();
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
      } else if (this.recvData !== null) {        
        this.recvData = Buffer.concat([this.recvData, data]);
      }

      if (this.responseLength && this.recvData != null && this.recvData.length >= this.responseLength) {        
        const response = this.recvData;
        this.recvData = null;
        this.responseLength = null;
        const deserializer = new Deserializer();
        if (this.requestHandle > 0x80000000) {
          deserializer.deserializeMethodResponse(
            Readable.from(response),
            (err: any, res: any) => {
              this.emit(`response:${this.requestHandle}`, [res, err]);
            }
          );
        } else {
          deserializer.deserializeMethodCall(
            Readable.from(response),
            (err: any, method: any, res: any) => {
              this.emit("callback", method, res);
              this.emit(method, res);
            }
          );
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
  async disconnect(): Promise<true> {
    this.socket?.destroy();
    this.isConnected = false;
    this.emit("connect", false);
    return true;
  }
}
