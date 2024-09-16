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
                this.onSync && event.data && this.onSync(JSON.parse(event.data));

            };
        };

        connectWebSocket();
    }

    onConnected = () => { }
    onSync = (event: { type: string, data: RecordModel[] }) => { }

    async sync(type: string, dataArray: RecordModel[], timespan: number) {


        try {
            if (this.isConnected) {
                await this.ws?.send(JSON.stringify({ type, timespan, dataArray }));
            }

        } catch { }
    }
}