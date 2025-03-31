import { RecordModel } from "../../shared/RecordModel";

export interface ISyncClient<T> {
    connect(infoSettings?: T): Promise<T>;
    onSync: (event: { type: string; data: RecordModel[]; }) => Promise<void>;
    sync: (type: string, dataArray: RecordModel[], timespan: number) => void;
    isConnected: boolean;
}
