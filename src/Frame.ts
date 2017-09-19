import {Byte} from './Byte';
import {IHeaders} from './IHeaders';

export class Frame
{
    public static marshall(command: string, headers: IHeaders, body: string): string
    {
        const frame = new Frame(command, headers, body);
        return frame.toString() + Byte.NULL;
    }

    public static unmarshall(datas: string): {frames: Frame[], partial: string}
    {
        const frames = datas.split(RegExp('' + Byte.NULL + Byte.LF + '*'));

        const r = {
          frames: [],
          partial: '',
        };

        const firstFrames: string[] = frames.slice(0, -1);
        for (const frame of firstFrames) {
            r.frames.push(Frame.unmarshallSingle(frame));
        }

        const lastFrame: string = frames.slice(-1)[0];

        if (lastFrame === Byte.LF || (lastFrame.search(RegExp('' + Byte.NULL + Byte.LF + '*$'))) !== -1) {
            r.frames.push(Frame.unmarshallSingle(lastFrame));
        } else {
            r.partial = lastFrame;
        }

        return r;
    }

    private static sizeOfUTF8(s: string): number
    {
        if (s) {
          return encodeURI(s).match(/%..|./g).length;
        } else {
          return 0;
        }
    }

    private static unmarshallSingle(data: string): Frame
    {
        const divider: number = data.search(RegExp('' + Byte.LF + Byte.LF));
        const headerLines: string[] = data.substring(0, divider).split(Byte.LF);
        const command: string = headerLines.shift();

        const headers: IHeaders = {};
        const trim = (str) => {
          return str.replace(/^\s+|\s+$/g, '');
        };

        for (const line of headerLines.reverse()) {
            const idx = line.indexOf(':');
            headers[trim(line.substring(0, idx))] = trim(line.substring(idx + 1));
        }

        let body = '';
        const start = divider + 2;
        if (headers['content-length']) {
            const len = parseInt(headers['content-length'], 10);
            body = ('' + data).substring(start, start + len);
        } else {
            for (let i = start; i <= data.length; i++) {
                const chr = data.charAt(i);
                if (chr === Byte.NULL) {
                    break;
                }
                body += chr;
            }
        }

        return new Frame(command, headers, body);
    }

    public ack: (headers?: IHeaders) => void;
    public nack: (headers?: IHeaders) => void;
    public receipt: boolean;

    constructor(public command: string, public headers: IHeaders = {}, private body: string = '')
    {
    }

    public toString(): string
    {
        const lines: string[] = [this.command];
        const skipContentLength = this.headers['content-length'] === false;

        if (skipContentLength) {
          delete this.headers['content-length'];
        }

        for (const name in this.headers) {
            if (!this.headers.hasOwnProperty(name)) { continue; }
            const value = this.headers[name];
            lines.push('' + name + ':' + value);
        }

        if (this.body && !skipContentLength) {
            lines.push('content-length:' + (Frame.sizeOfUTF8(this.body)));
        }
        lines.push(Byte.LF + this.body);

        return lines.join(Byte.LF);
    }
}
