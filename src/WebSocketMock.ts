
export class Event
{
    constructor(public type)
    {
    }
}

export class MessageEvent
{
    constructor(public type, public data)
    {
    }
}

export class WebSocketMock
{
    public binaryType: string;

    public onclose: (ev: CloseEvent) => void;
    public onopen: (ev: Event) => void;
    public onerror: (ev: Event) => void;
    public onmessage: (ev: MessageEvent) => void;
    public readyState = 0;
    public bufferedAmount = 0;
    public extensions = '';
    public protocol = '';

    public CLOSED = 3;
    public CLOSING = 2;
    public CONNECTING = 0;
    public OPEN = 1;

    constructor(public url: string)
    {
        setTimeout(() => { this.handle_open(''); }, 0);
    }

    public addEventListener() { }
    public dispatchEvent(evt: Event): boolean { return false; }
    public removeEventListener() { }

    public close()
    {
        this.handle_close();
        this.readyState = 2;
    }

    public send(msg): boolean
    {
        if (this.readyState !== 1) {
            return false;
        }

        this.handle_send(msg);

        return true;
    }

    protected handle_send(msg) { }
    protected handle_close(msg?) { }
    protected handle_open(msg) { }

    protected _accept()
    {
        this.readyState = 1;

        this.onopen(new Event('open'));
    }

    protected _shutdown()
    {
        this.readyState = 3;
        this.onclose(new CloseEvent('close'));
    }

    protected _error()
    {
        this.readyState = 3;
        this.onerror(new Event('error'));
    }

    protected _respond(data: string)
    {
        this.onmessage(new MessageEvent('message', data));
    }
}
