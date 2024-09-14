class SyncDbClient {

    ws;
    url;
    isConnected;

    constructor(url = 'http://localhost:3000') {
        this.url = url;
    }

    connect() {
        this.ws = new WebSocket(`${this.url.replace("http", "ws")}/echo`);

        this.ws.onopen = () => {
            this.whenConnected && this.whenConnected();
            this.isConnected = true;
        };

        this.ws.onmessage = (event) => {
            this.onSync && event.data && this.onSync(JSON.parse(event.data));
        };

        this.ws.onclose = () => {
            this.onClosed && this.onClosed();
        };
    }

    onConnected = () => { }
    onClosed = () => { }
    onSync = (event) => { }


    async sync(type, dataArray, timespan) {


        try {
            if (this.isConnected) {
                await this.ws.send(JSON.stringify({ type, timespan, dataArray }));
            }

        } catch { }
    }

}

class LocalDbClient {

    syncClass;

    constructor(syncClass) {
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
                    ...currentData.filter(x => !arrayDataIds.includes(x.record_id) && !arrayDataIds2.includes(x.id)),
                    ...arrayData
                ];

                this._assign(type, newData);
                this.onUpdated && this.onUpdated();
            }
        }
    }


    onUpdated = () => { };

    _get(type) {
        return JSON.parse(localStorage.getItem(type)) ?? [];
    }

    _assign(type, data) {
        localStorage.setItem(type, JSON.stringify(data));
    }

    _getLatestRemoreUpdate(type) {
        let info = this._get(type).filter(x => !!x.record_timespan);
        return info.length === 0 ? 0 : Math.max(...info.map(x => x.record_timespan))
    }

    async sync(type) {

        if (this.syncClass) {
            let syncNewData = this._get(type).filter(x => !x.record_timespan || !x.record_id)
            await this.syncClass.sync(type, syncNewData ?? [], this._getLatestRemoreUpdate(type));
        }

        this.onUpdated && this.onUpdated();
    }

    async get(type) {
        return this._get(type).filter(x => !x.record_isDeleted);
    }

    async save(type, arrayData) {
        const newData = [...this._get(type), ...arrayData.map(x => ({ ...x, record_timespan: undefined }))]
        this._assign(type, newData);

        await this.sync(type);
    }

    async update(type, arrayData) {

        let currentData = this._get(type);

        let newData = currentData.map(current => {

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

    async delete(type, id) {
        let currentData = this._get(type);
        let newData = currentData.map(x => x.id.toString() === id.toString() ? { ...x, record_timespan: undefined, record_isDeleted: true } : x);
        this._assign(type, newData);
        await this.sync(type);
    }

}