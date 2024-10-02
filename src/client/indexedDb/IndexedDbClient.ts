import { IDbClient } from "../core/IDbClient";
import { DbSubscription } from "../core/DbSubscription";
import { ISyncClient } from "../../remote/core/ISyncClient";
import { FILE_RECORD_TYPE, RecordModel } from "../../shared/RecordModel";

export class IndexedDbClient implements IDbClient {

    private syncClass?: ISyncClient;
    private subscriptions: DbSubscription[] = [];

    public deleteLocalData(): Promise<boolean> {
        return new Promise((res, rej) => {
            var req = indexedDB.deleteDatabase(this.dbName);
            req.onsuccess = function () {
                res(true);
            };
            req.onerror = function () {
                res(false);
            };
            req.onblocked = function () {
                res(false);
            };
        })
    }

    private getCurrentStores() {
        return new Promise<{ version: number; stores: string[]; }>((res, rej) => {
            let request = indexedDB.open(this.dbName);

            request.onsuccess = event => {
                const db = (event.target as IDBOpenDBRequest).result;
                let data = { version: db.version, stores: [...(<any>db.objectStoreNames)] };
                db.close();
                res(data);
            };

            request.onerror = error => {
                rej(error);
            };
        });
    }

    private getOrCreateDefaultDb() {
        return new Promise<IDBDatabase>(async (res, rej) => {
            let currentStores = await this.getCurrentStores();

            const missingStores = !this.allStores.every(store => currentStores.stores.includes(store));

            let request = (missingStores)
                ? indexedDB.open(this.dbName, currentStores.version + 1)
                : indexedDB.open(this.dbName);

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;

                this.allStores.forEach(type => {
                    if (!db.objectStoreNames.contains(type)) {
                        db.createObjectStore(type, { keyPath: 'id' });
                    }
                });
            };

            request.onsuccess = event => {
                const db = (event.target as IDBOpenDBRequest).result;
                res(db);
            };

            request.onerror = error => {
                rej(error);
            };
        });
    }

    private get allStores() {
        return [...this.stores, FILE_RECORD_TYPE];
    }

    constructor(private dbName: string, private stores: string[], syncClass?: ISyncClient) {
        if (syncClass) {
            this.syncClass = syncClass;
            this.syncClass.connect();
            this.syncClass.onSync = (data) => this.onSync(data);
        }
    }

    private async onSync(data: { type: string; data: RecordModel[] }) {
        let arrayData = data.data;
        let type = data.type;

        if (arrayData.length > 0) {
            const currentData = await this._get(type)
            const arrayDataIds = arrayData.map(x => x.record_id);
            const arrayDataIds2 = arrayData.map((x: any) => x.id);

            const newData = [
                ...currentData.filter((x: any) => !arrayDataIds.includes(x.record_id) && !arrayDataIds2.includes(x.id)),
                ...arrayData
            ] as RecordModel[];

            this._assign(type, newData, true);
            this.onUpdated && this.onUpdated(type);
        }
    }

    private onUpdated = (type: string) => {
        this.subscriptions
            .filter(sub => sub.type === type)
            .forEach(sub => sub.callback());
    };

    public subscribe(type: string, callback: () => void) {
        const subscription = new DbSubscription(type, callback, this);
        this.subscriptions.push(subscription);
        return subscription;
    };

    public unsubscribe(subscription: DbSubscription) {
        this.subscriptions = this.subscriptions.filter(sub => sub !== subscription);
    };

    private async _get<T>(type: string): Promise<T[]> {

        return new Promise(async (resolve, reject) => {

            let db: IDBDatabase | undefined;

            try {
                db = await this.getOrCreateDefaultDb();

                const transaction = db.transaction(type, 'readonly');
                const store = transaction.objectStore(type);
                const getRequest = store.getAll();

                getRequest.onsuccess = () => {
                    resolve(getRequest.result || []);
                    db?.close();
                };

                getRequest.onerror = () => {
                    reject(getRequest.error);
                    db?.close();
                };

            } catch (error) {
                reject(error);

            } finally {
                db?.close();
            }
        });
    }

    private async _assign<T extends RecordModel>(type: string, data: T[], isFromServer: boolean = false) {
        return new Promise(async (resolve, reject) => {
            let db: IDBDatabase | undefined;

            try {
                db = await this.getOrCreateDefaultDb();

                const transaction = db.transaction(type, 'readwrite');
                const store = transaction.objectStore(type);

                data.forEach(item => {

                    if (isFromServer && item.record_isDeleted) {
                        store.delete(item.id);
                    } else {
                        const putRequest = store.put(item);

                        putRequest.onsuccess = () => {
                            resolve(putRequest.result);
                        };

                        putRequest.onerror = () => {
                            reject(putRequest.error);
                        };
                    }
                });

            } catch (error) {
                reject(error);
            }
        });
    }

    private async _getLatestRemoteUpdate<T extends RecordModel>(type: string): Promise<number> {
        const data = await this._get<T>(type);
        const info = data.filter((x: T) => !!x.record_timespan);
        return info.length === 0 ? 0 : Math.max(...info.map((x: T) => x.record_timespan!));
    }

    async syncAll() {
        this.allStores.forEach((store) => this.sync(store));
    }

    async sync<T extends RecordModel>(type: string) {
        this.onUpdated && this.onUpdated(type);

        if (this.syncClass && this.syncClass.isConnected) {
            const syncNewData = (await this._get<T>(type)).filter((x: T) => !x.record_timespan || !x.record_id) as T[];
            this.syncClass.sync(type, syncNewData ?? [], await this._getLatestRemoteUpdate(type));
        }
    }

    async get<T extends RecordModel>(type: string): Promise<T[]> {
        const data = await this._get<T>(type);
        return data.filter((x: T) => !x.record_isDeleted) as T[];
    }

    async add<T extends RecordModel>(type: string, arrayData: T[]) {
        const currentData = await this._get<T>(type);
        const newData = [...currentData, ...arrayData.map(x => ({ ...x, record_timespan: undefined }))];
        await this._assign(type, newData);

        await this.sync(type);
    }

    async addOrUpdate<T extends RecordModel>(type: string, arrayData: T[]) {
        const currentData = await this._get<T>(type);

        const newData = currentData.map((current: T) => {
            const found = arrayData.find(_new => (current.record_id && current.record_id === _new.record_id) || current.id === _new.id);

            if (found) {
                return { ...found, id: current.id, record_id: current.record_id, record_timespan: undefined };
            } else {
                return current;
            }
        });

        const newItems = arrayData.filter((current: T) => {
            return !currentData.find(_new => (current.record_id && current.record_id === _new.record_id) || current.id === _new.id);
        });

        await this._assign(type, [...newData, ...newItems]);

        await this.sync(type);
    }

    async update<T extends RecordModel>(type: string, arrayData: T[]) {
        const currentData = await this._get<T>(type);

        const newData = currentData.map((current: T) => {
            const found = arrayData.find(_new => current.record_id === _new.record_id || current.id === _new.id);

            if (found) {
                return { ...found, id: current.id, record_id: current.record_id, record_timespan: undefined };
            } else {
                return current;
            }
        });

        await this._assign(type, newData);

        await this.sync(type);
    }

    async delete<T extends RecordModel>(type: string, id: string) {
        const currentData = await this._get<T>(type);
        const newData = currentData.map((x: T) => x.id.toString() === id.toString() ? { ...x, record_timespan: undefined, record_isDeleted: true } : x);
        await this._assign(type, newData);
        await this.sync(type);
    }
}
