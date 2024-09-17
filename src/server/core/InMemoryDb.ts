import { randomUUID } from 'crypto';
import { RecordModel } from '../../shared/RecordModel';
import ISyncDB from './ISyncDB';

export class InMemorySyncDb implements ISyncDB {
    private db: { [collection: string]: RecordModel[] } = {};

    private initialize(type: string) {
        if (!this.db[type]) {
            this.db[type] = [];
        }
    };

    async sync(type: string, syncData: RecordModel[], timespan: number): Promise<{ changes: RecordModel[], syncData: RecordModel[] }> {

        this.initialize(type)
        let currentData = this.db[type];
        let changes: RecordModel[] = [];

        //updated or deleted
        currentData = currentData
            .map(current => {
                let newData = syncData.find(_new => _new.record_id === current.record_id);

                if (newData && newData.record_timespan! > current.record_timespan!) {
                    let newChange = { ...newData, record_timespan: new Date().getTime() };
                    changes.push(newChange);
                    return newChange;
                }

                return current;
            });

        //new Items
        syncData
            .map(_new => ({
                newData: _new,
                current: currentData.find(current => _new.record_id === current.record_id)
            }))
            .filter(_new => !_new.current)
            .forEach(x => {
                let newChange = {
                    ...x.newData!,
                    record_id: x.newData.record_id ?? randomUUID(),
                    record_timespan: new Date().getTime(),
                    record_isDeleted: false
                };
                changes.push(newChange);

                currentData.push(newChange);
            });


        this.db[type] = currentData;

        return {
            changes,
            syncData: this.db[type].filter(collection => collection.record_timespan! > timespan)
        }
    };
}
