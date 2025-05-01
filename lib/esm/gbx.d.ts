/// <reference types="node" />
import { Buffer } from "node:buffer";
import { type GbxClient } from "./index";
export interface GbxOptions {
    showErrors: boolean;
    throwErrors: boolean;
}
export declare class Gbx {
    isConnected: boolean;
    doHandShake: boolean;
    reqHandle: number;
    private socket;
    recvData: Buffer;
    responseLength: null | number;
    requestHandle: number;
    dataPointer: number;
    server: GbxClient;
    options: GbxOptions;
    timeoutHandler: any;
    promiseCallbacks: {
        [key: string]: {
            resolve: CallableFunction;
            reject: CallableFunction;
        };
    };
    game: string;
    /**
     * Creates an instance of GbxClient.
     * @memberof GbxClient
     */
    constructor(server: GbxClient, options?: GbxOptions);
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
     * execute a xmlrpc method call on a server
     *
     * @param {string} method
     * @param {...any} params
     * @returns any
     * @memberof GbxClient
     */
    send(method: string, ...params: any): Promise<any> | undefined;
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
    multicall(methods: Array<any>): Promise<any>;
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
    multisend(methods: Array<any>): Promise<undefined>;
    private query;
    /**
     * Disconnect
     *
     * @returns Promise<true>
     * @memberof GbxClient
     */
    disconnect(): Promise<true>;
}
