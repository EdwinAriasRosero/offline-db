import { RecordModel } from "./RecordModel";

export interface ISyncClient {
    connect(): void;
    onSync: (event: { type: string, data: RecordModel[] }) => void;
    sync: (type: string, dataArray: RecordModel[], timespan: number) => void;
}

export class SyncDbClient implements ISyncClient {

    private ws?: WebSocket;
    private url: string;
    private isConnected: boolean = false;

    constructor(url = 'http://localhost:3000') {
        this.url = url;
    }

    connect() {
        const connectWebSocket = () => {
            this.ws = new WebSocket(`${this.url.replace("http", "ws")}/echo`);

            this.ws.onopen = () => {
                console.log('Connected');
                this.isConnected = true;
                this.onConnected && this.onConnected();
            };

            this.ws.onclose = () => {
                console.log('Disconnected. Reconnecting...');
                this.isConnected = false;
                setTimeout(connectWebSocket, 5000); // Retry connection after 5 seconds
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket Error:', error);
                this.isConnected = false;
            };

            this.ws.onmessage = (event) => {
                this.onSync && event.data && this.onSync(JSON.parse(event.data, reviver));

            };
        };

        connectWebSocket();
    }

    onConnected = () => { }
    onSync = (event: { type: string, data: RecordModel[] }) => { }

    async sync(type: string, dataArray: RecordModel[], timespan: number) {


        try {
            if (this.isConnected) {
                await this.ws?.send(JSON.stringify({ type, timespan, dataArray }, replacer));
            }

        } catch { }
    }
}

function replacer(key: string, value: any): any {
    if (value instanceof Date) {
        return { convertedTypeSerialization: 'Date', value: value.toISOString() };
    }
    if (value && typeof value === 'object') {
        if (Array.isArray(value)) {
            return value.map(item => replacer(key, item));
        }
        for (const k in value) {
            if (value.hasOwnProperty(k)) {
                value[k] = replacer(k, value[k]);
            }
        }
    }
    return value;
}

function reviver(key: string, value: any): any {
    if (value && value.convertedTypeSerialization === 'Date') {
        return new Date(value.value);
    }
    if (value && typeof value === 'object') {
        if (Array.isArray(value)) {
            return value.map(item => reviver(key, item));
        }
        for (const k in value) {
            if (value.hasOwnProperty(k)) {
                value[k] = reviver(k, value[k]);
            }
        }
    }
    return value;
}
