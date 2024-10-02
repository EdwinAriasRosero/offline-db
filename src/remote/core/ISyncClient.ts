import { RecordModel } from "../../shared/RecordModel";

export interface ISyncClient {
    connect(): void;
    onSync: (event: { type: string; data: RecordModel[]; }) => Promise<void>;
    sync: (type: string, dataArray: RecordModel[], timespan: number) => void;
    isConnected: boolean;
}
