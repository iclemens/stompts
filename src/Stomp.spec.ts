// Stomp = require('../../lib/stomp.js').Stomp
// StompServerMock = require('./server.mock.js').StompServerMock
// Stomp.WebSocketClass = StompServerMock

import {} from 'jasmine';
import {Stomp} from './Stomp';
import {StompServerMock} from './StompServerMock';

describe('Stomp', () => {
    describe('', () => {
        let client;

        beforeEach((done) => {
            const ws = new StompServerMock('ws://mocked/stomp/server');
            client = Stomp.over(ws);
            // client.debug = console.log;
            client.connect('guest', 'guest', done);
        });

        it('lets you connect to a server with a websocket and get a callback', () => {
            expect(client.connected).toBe(true);
        });

    });

    describe('', () => {
        let client;
        let subscription;

        beforeEach((done) => {
            const ws = new StompServerMock('ws://mocked/stomp/server');
            client = Stomp.over(ws);

            client.connect('guest', 'guest', () => {
                subscription = client.subscribe('/queue/test');
                done();
            });
        });

        it('lets you subscribe to a destination', () => {
            expect(Object.keys(client.ws.subscriptions)).toContain(subscription.id);
        });
    });

    describe('', () => {
        let message;
        let client;

        beforeEach((done) => {
            const ws = new StompServerMock('ws://mocked/stomp/server');
            client = Stomp.over(ws);

            client.connect('guest', 'guest', () => {
                message = 'Hello world!';
                client.send('/queue/test', {}, message);
                done();
            });
        });

        it('lets you publish a message to a destination', () => {
            expect(client.ws.messages.pop().toString()).toContain(message);
        });
    });


    describe('', () => {
        let client;
        let subscription;

        beforeEach((done) => {
            const ws = new StompServerMock('ws://mocked/stomp/server');
            client = Stomp.over(ws);

            client.connect('guest', 'guest', () => {
                subscription = client.subscribe('/queue/test');
                subscription.unsubscribe();
                done();
            });
        });

        it('lets you unsubscribe from a destination', () => {
            expect(Object.keys(client.ws.subscriptions)).not.toContain(subscription.id);
        });
    });

    describe('', () => {
        let client;
        let subscription;
        const messages = [];

        beforeEach((done) => {
            const ws = new StompServerMock('ws://mocked/stomp/server');
            client = Stomp.over(ws);
            subscription = null;
            client.connect('guest', 'guest', () => {
                subscription = client.subscribe('/queue/test', (msg) => messages.push(msg));
                done();
            });
        });

        it('lets you receive messages only while subscribed', () => {
            client.ws.test_send(subscription.id, Math.random());
            client.ws.test_send(subscription.id, Math.random());
            expect(messages.length).toEqual(2);
            subscription.unsubscribe();
            try {
                client.ws.test_send(subscription.id, Math.random());
            } catch (err) {
            }
            expect(messages.length).toEqual(2);
        });
    });

    describe('', () => {
        let client;

        beforeEach((done) => {
            const ws = new StompServerMock('ws://mocked/stomp/server');
            client = Stomp.over(ws);

            client.connect('guest', 'guest', () => { done(); });
        });

        it('lets you send messages in a transaction', () => {
            const txid = '123';
            client.begin(txid);
            client.send('/queue/test', {transaction: txid}, 'messages 1');
            client.send('/queue/test', {transaction: txid}, 'messages 2');
            expect(client.ws.messages.length).toEqual(0);
            client.send('/queue/test', {transaction: txid}, 'messages 3');
            client.commit(txid);
            expect(client.ws.messages.length).toEqual(3);
        });
    });

    describe('', () => {
        let client;

        beforeEach((done) => {
            const ws = new StompServerMock('ws://mocked/stomp/server');
            client = Stomp.over(ws);

            client.connect('guest', 'guest', () => { done(); });
        });

        it('lets you abort a transaction', () => {
            const txid = '123';
            client.begin(txid);
            client.send('/queue/test', {transaction: txid}, 'messages 1');
            client.send('/queue/test', {transaction: txid}, 'messages 2');
            expect(client.ws.messages.length).toEqual(0);
            client.send('/queue/test', {transaction: txid}, 'messages 3');
            client.abort(txid);
            expect(client.ws.messages.length).toEqual(0);
        });
    });
});
