import { Gbx } from "./gbx";
import EventEmitter from "node:events";

export class GbxClient {
    /**
     * Gbx instance
     */
    gbx: Gbx;

    /** @ignore */
    private events: EventEmitter = new EventEmitter();
    /** @ignore */

    constructor(options: any) {
        this.events.setMaxListeners(100);
        this.gbx = new Gbx(this, options);
    }

    onDisconnect(str: string) {
        this.events.emit("disconnect", str);
    }

    async onCallback(method: string, data: any) {
        this.events.emit("callback", method, data);
        this.events.emit(method, data);
    }

    /**
     * Send request and wait for response
     * @param method
     * @param args
     * @returns
     */
    async call(method: string, ...args: any) {
        return this.gbx.call(method, ...args);
    }

    addListener(
        method: string,
        callback: any,
        obj: object | undefined = undefined
    ) {
        const wrapper = callback.bind(obj);
        wrapper.listener = callback;
        this.events.addListener(method, wrapper);
    }

    on(method: string, callback: any, obj: object | undefined = undefined) {
        const wrapper = callback.bind(obj);
        wrapper.listener = callback;
        this.events.addListener(method, wrapper);
    }

    prependListener(
        method: string,
        callback: any,
        obj: object | undefined = undefined
    ) {
        const wrapper = callback.bind(obj);
        wrapper.listener = callback;
        this.events.prependListener(method, wrapper);
    }

    removeListener(method: string, callback: any) {
        this.events.removeListener(method, callback);
    }

    emit(method: string, ...args: any) {
        this.events.emit(method, ...args);
    }

    /**
     * send request and ignore everything
     * @param method
     * @param args
     * @returns
     */
    send(method: string, ...args: any) {
        try {
            return this.gbx.send(method, ...args);
        } catch (e: any) {
            console.error(e.message);
            return undefined;
        }
    }

    /**
     * call script method
     * @param method
     * @param args
     * @returns
     */
    async callScript(method: string, ...args: any) {
        return this.gbx.callScript(method, ...args);
    }

    /** perform multicall */
    async multicall(methods: any[]) {
        try {
            return this.gbx.multicall(methods);
        } catch (e: any) {
            console.error(e.message);
            return undefined;
        }
    }

    /** perform multicall */
    async multisend(methods: any[]) {
        try {
            return this.gbx.multisend(methods);
        } catch (e: any) {
            console.error(e.message);
            return undefined;
        }
    }

    /**
     * connect to server
     * @param host
     * @param port
     */
    async connect(host: string, port: number): Promise<boolean> {
        try {
            const answer = this.gbx.connect(host, port);
            this.events.emit("connect", true);
            return answer;
        } catch (e: any) {
            console.error(e.message);
        }
        return false;
    }
}
