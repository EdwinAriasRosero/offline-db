import { IDbClient } from "./IDbClient";
import { RecordModel } from "../../shared/RecordModel";

export class DbInstace<T extends RecordModel> {

    constructor(protected client: IDbClient, private type: string) { }

    subscribe(callback: () => void) {
        const subscription = this.client.subscribe(this.type, callback);
        this.sync();
        return subscription;
    }

    async get(): Promise<T[]> {
        return await this.client.get(this.type) as T[];
    }

    async add(arrayData: T[]) {
        return await this.client.add(this.type, arrayData);
    }

    async update(arrayData: T[]) {
        return await this.client.update(this.type, arrayData);
    }

    async addOrUpdate(arrayData: T[]) {
        return await this.client.addOrUpdate(this.type, arrayData);
    }

    async delete(id: string) {
        return await this.client.delete(this.type, id);
    }

    async sync() {
        this.client.sync(this.type);
    }
}