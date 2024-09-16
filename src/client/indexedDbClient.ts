import { RecordModel } from "./RecordModel";
import { ISyncClient } from "./syncDbClient";

export class IndexedDbClient {
    private syncClass?: ISyncClient;
    private dbName = 'localDb';

    constructor(stores: string[], syncClass?: ISyncClient) {

        const request = indexedDB.open(this.dbName);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;

            stores.forEach(type => {
                if (!db.objectStoreNames.contains(type)) {
                    db.createObjectStore(type, { keyPath: 'id' });
                }
            });

        };

        if (syncClass) {
            this.syncClass = syncClass;
            this.syncClass.connect();
            this.syncClass.onSync = (data) => {
                let arrayData = data.data;
                let type = data.type;

                if (arrayData.length > 0) {
                    this._get(type).then(currentData => {
                        const arrayDataIds = arrayData.map(x => x.record_id);
                        const arrayDataIds2 = arrayData.map((x: any) => x.id);

                        const newData = [
                            ...currentData.filter((x: any) => !arrayDataIds.includes(x.record_id) && !arrayDataIds2.includes(x.id)),
                            ...arrayData
                        ];

                        this._assign(type, newData);
                        this.onUpdated && this.onUpdated(type);
                    });
                }
            }
        }
    }

    onUpdated = (type: string) => { };

    private async _get<T>(type: string): Promise<T[]> {
        return new Promise((resolve, reject) => {

            const request = indexedDB.open(this.dbName);

            request.onsuccess = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;

                const transaction = db.transaction(type, 'readonly');
                const store = transaction.objectStore(type);
                const getRequest = store.getAll();

                getRequest.onsuccess = () => {
                    resolve(getRequest.result || []);
                    db.close();
                };

                getRequest.onerror = () => {
                    reject(getRequest.error);
                    db.close();
                };
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    private async _assign<T>(type: string, data: T[]) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName);
            request.onsuccess = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                const transaction = db.transaction(type, 'readwrite');
                const store = transaction.objectStore(type);

                data.forEach(item => {

                    const putRequest = store.put(item);

                    putRequest.onsuccess = () => {
                        resolve(putRequest.result);
                    };

                    putRequest.onerror = () => {
                        reject(putRequest.error);
                    };
                })


            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    private async _getLatestRemoteUpdate<T extends RecordModel>(type: string): Promise<number> {
        const data = await this._get<T>(type);
        const info = data.filter((x: T) => !!x.record_timespan);
        return info.length === 0 ? 0 : Math.max(...info.map((x: T) => x.record_timespan!));
    }

    async sync<T extends RecordModel>(type: string) {
        if (this.syncClass) {
            const syncNewData = (await this._get<T>(type)).filter((x: T) => !x.record_timespan || !x.record_id) as T[];
            await this.syncClass.sync(type, syncNewData ?? [], await this._getLatestRemoteUpdate(type));
        }

        this.onUpdated && this.onUpdated(type);
    }

    async get<T extends RecordModel>(type: string): Promise<T[]> {
        const data = await this._get<T>(type);
        return data.filter((x: T) => !x.record_isDeleted) as T[];
    }

    async save<T extends RecordModel>(type: string, arrayData: T[]) {
        const currentData = await this._get<T>(type);
        const newData = [...currentData, ...arrayData.map(x => ({ ...x, record_timespan: undefined }))];
        await this._assign(type, newData);

        await this.sync(type);
    }

    async saveOrUpdate<T extends RecordModel>(type: string, arrayData: T[]) {
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