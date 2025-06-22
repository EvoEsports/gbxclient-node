import { Gbx } from "./gbx";
export declare class GbxClient {
    /**
     * Gbx instance
     */
    gbx: Gbx;
    /** @ignore */
    private events;
    /** @ignore */
    constructor(options: any);
    onDisconnect(str: string): void;
    onCallback(method: string, data: any): Promise<void>;
    /**
     * Send request and wait for response
     * @param method
     * @param args
     * @returns
     */
    call(method: string, ...args: any): Promise<any>;
    addListener(method: string, callback: any, obj?: object | undefined): void;
    on(method: string, callback: any, obj?: object | undefined): void;
    prependListener(method: string, callback: any, obj?: object | undefined): void;
    removeListener(method: string, callback: any): void;
    emit(method: string, ...args: any): void;
    /**
     * send request and ignore everything
     * @param method
     * @param args
     * @returns
     */
    send(method: string, ...args: any): Promise<any> | undefined;
    /**
     * call script method
     * @param method
     * @param args
     * @returns
     */
    callScript(method: string, ...args: any): Promise<any>;
    /** perform multicall */
    multicall(methods: any[]): Promise<any>;
    /** perform multicall */
    multisend(methods: any[]): Promise<undefined>;
    /**
     * connect to server
     * @param host
     * @param port
     */
    connect(host: string, port: number): Promise<boolean>;
    disconnect(): Promise<boolean>;
}
