import { IDbClient } from "./IDbClient";

export class DbSubscription {

    constructor(public type: string,
        public callback: () => void,
        public instance: IDbClient) {
    }

    unsubscribe() {
        this.instance?.unsubscribe(this);
    }
}
