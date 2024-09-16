import { RecordModel } from "../RecordModel";


export default interface ISyncDB {
    sync(type: string, syncData: RecordModel[], timespan: number): Promise<{ hasChanged: boolean, data: RecordModel[] }>;
}
