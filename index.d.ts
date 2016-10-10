
export interface StompMessage
{
    command: string
    headers: {[key: string]: any}
    body: any
    ack: any
}

export interface StompClient
{
    connect(login: string, passcode: string, success?: (frame: any) => void, error?: (frame: any) => void): void;
    subscribe(destination: string, callback: (message: StompMessage) => void): void;
    send(destination: string, headers: {[key: string]: any}, message: string): void;

    debug: (message: any) => void;
}

export interface StompInterface
{
    client(url: string, protocols?: string[]): StompClient;
}

export var Stomp: StompInterface;
