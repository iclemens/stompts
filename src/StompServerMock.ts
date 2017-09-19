import {Frame} from './Frame';
import {IHeaders} from './IHeaders';
import {Stomp} from './Stomp';
import {WebSocketMock} from './WebSocketMock';

export class StompServerMock extends WebSocketMock
{
    public transactions;
    public subscriptions;
    public messages;
    public sessionId: string;

    //  Test helpers
    public test_send(subId, message)
    {
        const msgid = 'msg-' + Math.random();
        this.subscriptions[subId][1](msgid, message);
    }

    protected handle_send(msg)
    {
        this.stomp_dispatch(Frame.unmarshall(msg).frames[0]);
    }

    protected handle_close()
    {
        this._shutdown();
    }

    protected handle_open()
    {
        this.stomp_init();
        this._accept();
    }

    // Stomp server implementation

    private stomp_init()
    {
        this.transactions = {};
        this.subscriptions = {};
        this.messages = [];
    }

    private stomp_send(command: string, headers: IHeaders, body?: string)
    {
        this._respond(Frame.marshall(command, headers, body));
    }

    private stomp_send_receipt(frame)
    {
        if (frame.headers.message) {
            this.stomp_send('ERROR', {'receipt-id': frame.headers['receipt-id'], 'message': frame.headers.message});
        } else {
            this.stomp_send('RECEIPT', {'receipt-id': frame.headers['receipt-id']});
        }
    }

    private stomp_send_message(destination, subscription, messageId, body)
    {
        this.stomp_send('MESSAGE', {
            'destination': destination,
            'message-id': messageId,
            'subscription': subscription}, body);
    }

    private stomp_dispatch(frame: Frame)
    {
        switch (frame.command.toLowerCase()) {
            case 'connect': this.stomp_handle_connect(frame); break;
            case 'begin': this.stomp_handle_begin(frame); break;
            case 'commit': this.stomp_handle_commit(frame); break;
            case 'abort': this.stomp_handle_abort(frame); break;
            case 'send': this.stomp_handle_send(frame); break;
            case 'subscribe': this.stomp_handle_subscribe(frame); break;
            case 'unsubscribe': this.stomp_handle_unsubscribe(frame); break;
            case 'disconnect': this.stomp_handle_disconnect(frame); break;

            default:
                window.console.log('StompServerMock: Unknown command: ' + frame.command);
                return;
        }

        if (frame.receipt) {
            this.stomp_send_receipt(frame);
        }
    }

    private stomp_handle_connect(frame)
    {
        this.sessionId = Math.random().toString();
        this.stomp_send('CONNECTED', {session: this.sessionId});
    }

    private stomp_handle_begin(frame)
    {
        this.transactions[frame.headers.transaction] = [];
    }

    private stomp_handle_commit(frame)
    {
        const transaction = this.transactions[frame.headers.transaction];
        for (const fr of transaction) {
            this.messages.push(fr.body);
        }
        delete this.transactions[frame.headers.transaction];
    }

    private stomp_handle_abort(frame)
    {
        delete this.transactions[frame.headers.transaction];
    }

    private stomp_handle_send(frame)
    {
        if (frame.headers.transaction) {
            this.transactions[frame.headers.transaction].push(frame);
        } else {
            this.messages.push(frame);
        }
    }

    private stomp_handle_subscribe(frame)
    {
        const subId = frame.headers.id || Math.random();
        const cb = (id, body) => this.stomp_send_message(frame.headers.destination, subId, id, body);
        this.subscriptions[subId] = [frame.headers.destination, cb];
    }

    private stomp_handle_unsubscribe(frame)
    {
        if (this.subscriptions[frame.headers.id]) {
            delete this.subscriptions[frame.headers.id];
        } else {
            frame.headers.message = 'Subscription does not exist';
        }
    }

    private stomp_handle_disconnect(frame)
    {
        this._shutdown();
    }
}
