import { randomUUID } from 'crypto';
import { RecordModel } from './RecordModel';
import ISyncDB from './ISyncDB';

export class InMemorySyncDb implements ISyncDB {
    private db: { [collection: string]: RecordModel[] } = {};

    private initialize(type: string) {
        if (!this.db[type]) {
            this.db[type] = [];
        }
    };

    async sync(type: string, syncData: RecordModel[], timespan: number): Promise<{ hasChanged: boolean, data: RecordModel[] }> {

        this.initialize(type)
        let currentData = this.db[type];

        //updated or deleted
        currentData = currentData
            .map(current => {
                let newData = syncData.find(_new => _new.record_id === current.record_id);

                return (newData && newData.record_timespan > current.record_timespan)
                    ? { ...newData, record_timespan: new Date().getTime() }
                    : current
            });

        //new Items
        syncData
            .map(_new => ({
                newData: _new,
                current: currentData.find(current => _new.record_id === current.record_id)
            }))
            .filter(_new => !_new.current)
            .forEach(x => {
                currentData.push({
                    ...x.newData!,
                    record_id: x.newData.record_id ?? randomUUID(),
                    record_timespan: new Date().getTime(),
                    record_isDeleted: false
                });
            });


        this.db[type] = currentData;

        return {
            hasChanged: false,
            data: this.db[type].filter(collection => collection.record_timespan > timespan);
        }
    };
}
