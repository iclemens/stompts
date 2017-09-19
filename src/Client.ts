import {Byte} from './Byte';
import {Frame} from './Frame';
import {IHeaders} from './IHeaders';
import {Stomp} from './Stomp';

export interface ISubscription
{
    id: string;
    unsubscribe: () => void;
}

export class Client<T extends WebSocket>
{
    private static now(): number
    {
        if (Date.now) {
          return Date.now();
        } else {
          return new Date().valueOf();
        }
    }

    public onreceive: (frame: Frame) => void;
    public onreceipt: (frame: Frame) => void;
    public connected: boolean;
    public subscriptions = {};

    // var now;
    private counter: number = 0;

    private heartbeat: {outgoing: number, incoming: number} = {
        incoming: 10000,
        outgoing: 10000,
    };

    private maxWebSocketFrameSize = 16 * 1024;
    private partialData = '';
    private pinger: number;
    private ponger: number;
    private serverActivity: number;

    private debug: (...args: any[]) => void;
    private connectCallback: (frame: Frame) => void;

    constructor(public ws: T)
    {
        this.ws.binaryType = 'arraybuffer';
    }

    public doDebug(...args: any[])
    {
        if (this.debug) {
            this.debug.apply(this.debug, args);
        }
    }

    public connect(headers: IHeaders, connectCallback: (frame: Frame) => void,
                   errorCallback?: (frame: Frame) => void): (Event) => void;

    public connect(login: string, passcode: string, connectCallback: (frame: Frame) => void,
                   errorCallback?: (frame: Frame) => void, host?: string): (Event) => void;

    public connect(): (Event) => void
    {
        const args: any[] = 1 <= arguments.length ? [].slice.call(arguments, 0) : [];
        const out = this._parseConnect.apply(this, args);
        const headers: IHeaders = out[0];

        this.connectCallback = out[1];
        const errorCallback = out[2];

        this.doDebug('Opening Web Socket...');

        this.ws.onmessage = (evt: MessageEvent) => {
            const data: string = !(evt.data instanceof ArrayBuffer) ? evt.data :
                (() => {
                    const arr = new Uint8Array(evt.data);
                    this.doDebug('--- got data length: ' + arr.length);
                    const res: string[] = [];
                    for (let l = 0; l < arr.length; l++) {
                        const c = arr[l];
                        res.push(String.fromCharCode(c));
                    }

                    return res;
                })().join('');

            this.serverActivity = Client.now();
            if (data === Byte.LF) {
                this.doDebug('<<< PONG');

                return;
            }

            this.doDebug('<<< ', data);

            const unmarshalledData = Frame.unmarshall(this.partialData + data);
            this.partialData = unmarshalledData.partial;

            const results: any[] = [];
            for (const frame of unmarshalledData.frames) {
                switch (frame.command) {
                    case 'CONNECTED':
                        this.doDebug('connected to server ' + frame.headers.server);

                        this.connected = true;
                        this._setupHeartbeat(frame.headers);

                        results.push(this.connectCallback ? this.connectCallback(frame) : void 0);
                        break;

                    case 'MESSAGE':
                        const subscription = frame.headers.subscription;
                        const onreceive = this.subscriptions[subscription] || this.onreceive;

                        if (onreceive) {
                            const messageID: string = frame.headers['message-id'];
                            frame.ack = (hdrs: IHeaders = {}) => {
                                return this.ack(messageID, subscription, hdrs);
                            };

                            frame.nack = (hdrs: IHeaders = {}) => {
                                return this.nack(messageID, subscription, hdrs);
                            };

                            results.push(onreceive(frame));
                        } else {
                            this.doDebug('Unhandled received MESSAGE: ' + frame);
                            results.push(void 0);
                        }
                        break;

                    case 'RECEIPT':
                        results.push(this.onreceipt ? this.onreceipt(frame) : void 0);
                        break;

                    case 'ERROR':
                        results.push(errorCallback  ? errorCallback(frame) : void 0);
                        break;

                    default:
                        this.doDebug('Unhandled frame: ' + frame);
                        results.push(void 0);
                }
            }
            return results;
        };

        this.ws.onclose = () => {
            const msg = 'Whoops! Lost connection to' + this.ws.url;
            this.doDebug(msg);
            this._cleanUp();
            return errorCallback ? errorCallback(msg) : void 0;
        };

        return this.ws.onopen = (ev: Event): void => {
            this.doDebug('Web Socket Opened...');
            headers['accept-version'] = Stomp.VERSIONS.supportedVersions();
            headers['heart-beat'] = [this.heartbeat.outgoing, this.heartbeat.incoming].join(',');
            return this._transmit('CONNECT', headers);
        };
    }


    public disconnect(disconnectCallback: () => void, headers: IHeaders = {}): void
    {
        this._transmit('DISCONNECT', headers);
        this.ws.onclose = null;
        this.ws.close();
        this._cleanUp();
        return disconnectCallback ? disconnectCallback() : void 0;
    }


    public send(destination, headers: IHeaders = {}, body = ''): void
    {
        headers.destination = destination;
        return this._transmit('SEND', headers, body);
    }

    public subscribe(destination: string, callback?, headers: IHeaders = {}): ISubscription
    {
        if (!headers.id) {
            headers.id = 'sub-' + this.counter++;
        }
        headers.destination = destination;
        this.subscriptions[headers.id] = callback;
        this._transmit('SUBSCRIBE', headers);

        return {
            id: headers.id,
            unsubscribe: () => {
                return this.unsubscribe(headers.id);
            },
        };
    }

    public unsubscribe(id: string): void
    {
        delete this.subscriptions[id];

        return this._transmit('UNSUBSCRIBE', {
            id,
        });
    }

    public begin(transaction: string): {id: string, commit: () => void, abort: () => void}
    {
        const txid = transaction || 'tx-' + this.counter++;
        this._transmit('BEGIN', {
            transaction: txid,
        });
        const client = this;
        return {
            abort: () => client.abort(txid),
            commit: () => client.commit(txid),
            id: txid,
        };
    }

    public commit(transaction: string): void
    {
        return this._transmit('COMMIT', {
            transaction,
        });
    }

    public abort(transaction: string): void
    {
        return this._transmit('ABORT', {
            transaction,
        });
    }

    public ack(messageID: string, subscription: string, headers: IHeaders = {}): void {

        headers['message-id'] = messageID;
        headers.subscription = subscription;
        return this._transmit('ACK', headers);
    }

    public nack(messageID: string, subscription: string, headers: IHeaders = {}): void {
        headers['message-id'] = messageID;
        headers.subscription = subscription;
        return this._transmit('NACK', headers);
    }

    private _transmit(command, headers: IHeaders, body = ''): void
    {
        let out;
        out = Frame.marshall(command, headers, body);

        if (typeof this.debug === 'function') {
            this.debug('>>> ' + out);
        }

        while (true) {
            if (out.length > this.maxWebSocketFrameSize) {
                this.ws.send(out.substring(0, this.maxWebSocketFrameSize));
                out = out.substring(this.maxWebSocketFrameSize);
                if (typeof this.debug === 'function') {
                    this.debug('remaining = ' + out.length);
                }
            } else {
                return this.ws.send(out);
            }
        }
    }

    private _setupHeartbeat(headers: IHeaders)
    {
        const version = headers.version;
        if (version !== Stomp.VERSIONS.V1_1 && version !== Stomp.VERSIONS.V1_2) {
            return;
        }

        const hearbeat: number[] = ((): number[] => {
            const ref1 = headers['heart-beat'].split(',');
            const results: number[] = [];
            for (let i = 0; i < ref1.length; i++) {
                const v: string = ref1[i];
                results.push(parseInt(v, 10));
            }

            return results;
        })();

        const serverOutgoing = hearbeat[0];
        const serverIncoming = hearbeat[1];

        if (!(this.heartbeat.outgoing === 0 || serverIncoming === 0)) {
            const ttl = Math.max(this.heartbeat.outgoing, serverIncoming);
            if (typeof this.debug === 'function') {
                this.debug('send PING every ' + ttl + 'ms');
            }

            this.pinger = window.setInterval(ttl, () => {
                this.ws.send(Byte.LF);
                if (this.debug) { this.debug('>>> PING'); }
            });
        }

        if (!(this.heartbeat.incoming === 0 || serverOutgoing === 0)) {
            const ttl = Math.max(this.heartbeat.incoming, serverOutgoing);
            if (typeof this.debug === 'function') {
                this.debug('check PONG every ' + ttl + 'ms');
            }

            return this.ponger = setInterval(ttl, () => {
                const delta = Client.now() - this.serverActivity;
                if (delta > ttl * 2) {
                    if (typeof this.debug === 'function') {
                        this.debug('did not receive server activity for the last ' + delta + 'ms');
                    }
                    return this.ws.close();
                }
            });
        }
    }

    private _parseConnect(): [IHeaders, (frame: any) => void, (frame: any) => void] {
        let connectCallback: (frame: any) => void;
        let errorCallback: (frame: any) => void;

        const args: any[] = 1 <= arguments.length ? [].slice.call(arguments, 0) : [];
        let headers: IHeaders = {};

        switch (args.length) {
            case 2:
                headers = args[0];
                connectCallback = args[1];
                break;

            case 3:
                if (args[1] instanceof Function) {
                    headers = args[0];
                    connectCallback = args[1];
                    errorCallback = args[2];
                } else {
                    headers.login = args[0];
                    headers.passcode = args[1];
                    connectCallback = args[2];
                }
                break;
            case 4:
                headers.login = args[0];
                headers.passcode = args[1];
                connectCallback = args[2];
                errorCallback = args[3];
                break;
          default:
                headers.login = args[0];
                headers.passcode = args[1];
                connectCallback = args[2];
                errorCallback = args[3];
                headers.host = args[4];
        }

        return [headers, connectCallback, errorCallback];
    }

    private _cleanUp(): void
    {
        this.connected = false;
        if (this.pinger) {
            window.clearInterval(this.pinger);
        }
        if (this.ponger) {
            return window.clearInterval(this.ponger);
        }
    }
}
