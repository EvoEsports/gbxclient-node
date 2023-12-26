/// <reference types="node" />
import { EventEmitter as Events } from "events";
interface Options {
    showErrors?: boolean;
    throwErrors?: boolean;
}
export declare class GbxClient extends Events {
    host: string;
    port: number;
    isConnected: boolean;
    doHandShake: boolean;
    reqHandle: number;
    private socket;
    recvData: Buffer;
    responseLength: null | number;
    requestHandle: number;
    dataPointer: number;
    options: Options;
    /**
    * Creates an instance of GbxClient.
    * @memberof GbxClient
    */
    constructor(options?: Options);
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
    connect(host?: string, port?: number): Promise<boolean>;
    private handleData;
    /**
    * execute a xmlrpc method call on a server
    *
    * @param {string} method
    * @param {...any} params
    * @returns any
    * @memberof GbxClient
    */
    call(method: string, ...params: any): Promise<any>;
    /**
    * execute a script method call
    *
    * @param {string} method
    * @param {...any} params
    * @returns any
    * @memberof GbxClient
    */
    callScript(method: string, ...params: any): Promise<any>;
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
    multicall(methods: Array<any>): Promise<any[] | undefined>;
    private query;
    /**
    * Disconnect
    *
    * @returns Promise<true>
    * @memberof GbxClient
    */
    disconnect(): Promise<true>;
}
export {};
