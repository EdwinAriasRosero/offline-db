import { promises as fs } from 'fs';
import { RecordModel } from '../../shared/RecordModel';
import { randomUUID } from 'crypto';
import ISyncDB from './ISyncDB';
import path from 'path';
import { replacer, reviver } from '../../shared/jsonUtilities';

export class FileSystemSyncDb implements ISyncDB {
    private dbPath = './db';

    private async initialize(type: string) {
        const filePath = `${this.dbPath}/${type}.json`;
        const dirPath = path.dirname(filePath);

        try {
            await fs.mkdir(dirPath, { recursive: true });
            await fs.access(filePath);
        } catch {
            await fs.writeFile(filePath, JSON.stringify([]));
        }
    }

    private async readData(type: string): Promise<RecordModel[]> {
        const filePath = `${this.dbPath}/${type}.json`;
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data || '[]', reviver);
    }

    private async writeData(type: string, data: RecordModel[]): Promise<void> {
        const filePath = `${this.dbPath}/${type}.json`;
        await fs.writeFile(filePath, JSON.stringify(data, replacer, 2));
    }

    public async sync(type: string, syncData: RecordModel[], timespan: number): Promise<{ changes: RecordModel[], syncData: RecordModel[] }> {
        await this.initialize(type);
        let currentData = await this.readData(type);
        let changes: RecordModel[] = [];

        // Updated or deleted
        currentData = currentData.map(current => {
            const newData = syncData.find(_new => _new.record_id === current.record_id);

            if (newData && (!newData.record_timespan || newData.record_timespan > current.record_timespan!)) {
                let newChange = { ...newData, record_timespan: new Date().getTime() };
                changes.push(newChange);
                return newChange;
            } else {
                return current;
            }
        });

        // New items
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

        await this.writeData(type, currentData);

        return {
            changes,
            syncData: currentData.filter(collection => collection.record_timespan! > timespan)
        };
    }
}
