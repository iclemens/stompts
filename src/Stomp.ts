/*
   Stomp Over WebSocket http://www.jmesnil.net/stomp-websocket/doc/ | Apache License V2.0

   Copyright (C) 2010-2013 [Jeff Mesnil](http://jmesnil.net/)
   Copyright (C) 2012 [FuseSource, Inc.](http://fusesource.com)
 */

import {Client} from './Client';

export class Stomp<T extends WebSocket>
{
    public static VERSIONS = {
        V1_0: '1.0',
        V1_1: '1.1',
        V1_2: '1.2',
        supportedVersions: () => '1.1,1.0',
    };

    public static client(url: string,
                         protocols: (string | string[]) = ['v10.stomp', 'v11.stomp']): Client<WebSocket>
    {
        const ws: WebSocket = new WebSocket(url, protocols);
        return new Client<WebSocket>(ws);
    }

    public static over<T extends WebSocket>(ws: T): Client<T>
    {
        return new Client<T>(ws);
    }
}
