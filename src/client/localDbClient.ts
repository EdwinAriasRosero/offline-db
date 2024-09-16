import { ISyncClient } from "./syncDbClient";

export class LocalDbClient {

    private syncClass?: ISyncClient;

    constructor(syncClass: ISyncClient) {

        if (syncClass) {
            this.syncClass = syncClass;
            this.syncClass.connect();
            this.syncClass.onSync = (data) => {
                let arrayData = data.data;
                let type = data.type;

                if (arrayData.length > 0) {

                    const currentData = this._get(type);

                    const arrayDataIds = arrayData.map(x => x.record_id);
                    const arrayDataIds2 = arrayData.map(x => x.id);

                    const newData = [
                        ...currentData.filter((x: any) => !arrayDataIds.includes(x.record_id) && !arrayDataIds2.includes(x.id)),
                        ...arrayData
                    ];

                    this._assign(type, newData);
                    this.onUpdated && this.onUpdated();
                }
            }
        }
    }

    onUpdated = () => { };

    _get(type: string) {
        return JSON.parse(localStorage.getItem(type) ?? '[]') ?? [];
    }

    _assign(type: string, data: any[]) {
        localStorage.setItem(type, JSON.stringify(data));
    }

    _getLatestRemoreUpdate(type: string) {
        let info = this._get(type).filter((x: any) => !!x.record_timespan);
        return info.length === 0 ? 0 : Math.max(...info.map((x: any) => x.record_timespan))
    }

    async sync(type: string) {

        if (this.syncClass) {
            let syncNewData = this._get(type).filter((x: any) => !x.record_timespan || !x.record_id)
            await this.syncClass.sync(type, syncNewData ?? [], this._getLatestRemoreUpdate(type));
        }

        this.onUpdated && this.onUpdated();
    }

    async get(type: string) {
        return this._get(type).filter((x: any) => !x.record_isDeleted);
    }

    async save(type: string, arrayData: any[]) {
        const newData = [...this._get(type), ...arrayData.map(x => ({ ...x, record_timespan: undefined }))]
        this._assign(type, newData);

        await this.sync(type);
    }

    async update(type: string, arrayData: any[]) {

        let currentData = this._get(type);

        let newData = currentData.map((current: any) => {

            let found = arrayData.find(_new => current.record_id === _new.record_id || current.id === _new.id);

            if (found) {
                return { ...found, id: current.id, record_id: current.record_id, record_timespan: undefined };
            } else {
                return current;
            }
        });

        this._assign(type, newData);

        await this.sync(type);
    }

    async delete(type: string, id: string) {
        let currentData = this._get(type);
        let newData = currentData.map((x: any) => x.id.toString() === id.toString() ? { ...x, record_timespan: undefined, record_isDeleted: true } : x);
        this._assign(type, newData);
        await this.sync(type);
    }

}