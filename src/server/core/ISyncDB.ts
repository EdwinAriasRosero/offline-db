import { RecordModel } from "../../shared/RecordModel";

export default interface ISyncDB {
    sync(type: string, syncData: RecordModel[], timespan: number): Promise<{ changes: RecordModel[], syncData: RecordModel[] }>;
}
