# STOMP.js

This library provides a STOMP client for Web applications.

## Web Browser support

The library file is located in `dist/Stomp.js`.
It does not require any dependency (except WebSocket support from the browser or an alternative to WebSocket!)

Online [documentation][doc] describes the library API (including the [annotated source code][annotated]).

## node.js support

Install the 'stompjs' module

    $ npm install @mind-trace/stompjs

In the application, import the module with:

    import {Stomp} from '@mind-trace/stompjs';

To connect to a STOMP broker over a WebSocket, use the `Stomp.client(url)` method:

    var client = Stomp.client('ws://localhost:61614');

## Development Requirements

For development (testing, building) the project requires node.js. This allows us to run tests without the browser continuously during development.

    $ npm install

## Building and Testing

To build JavaScript from the TypeScript source code:

    $ tsc


## Browser Tests

* Make sure you have a running STOMP broker which supports the WebSocket protocol
 (see the [documentation][doc])
* Open in your web browser the project's [test page](browsertests/index.html)
* Check all tests pass

## Use

The project contains examples for using stomp.js
to send and receive STOMP messages from a server directly in the Web Browser or in a WebWorker.

## Authors

 * [Jeff Mesnil](http://jmesnil.net/)
 * [Jeff Lindsay](http://github.com/progrium)

[doc]: http://jmesnil.net/stomp-websocket/doc/
[annotated]: http://jmesnil.net/stomp-websocket/doc/stomp.html
