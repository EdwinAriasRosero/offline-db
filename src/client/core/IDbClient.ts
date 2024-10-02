import { DbSubscription } from "./DbSubscription";
import { RecordModel } from "../../shared/RecordModel";


export interface IDbClient {
    syncAll(): Promise<void>;
    sync<T extends RecordModel>(type: string): Promise<void>;
    get<T extends RecordModel>(type: string): Promise<T[]>;
    add<T extends RecordModel>(type: string, arrayData: T[]): Promise<void>;
    addOrUpdate<T extends RecordModel>(type: string, arrayData: T[]): Promise<void>;
    update<T extends RecordModel>(type: string, arrayData: T[]): Promise<void>;
    delete<T extends RecordModel>(type: string, id: string): Promise<void>;
    subscribe(type: string, callback: () => void): DbSubscription;
    unsubscribe(subscription: DbSubscription): void;
    deleteLocalData(): Promise<boolean>;
}
