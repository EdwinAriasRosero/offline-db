import { IDbClient } from "./IDbClient";
import { DbInstace } from "./DbInstace";
import { FILE_RECORD_TYPE, FileRecordModel } from "../../shared/RecordModel";

export class DbFileInstance extends DbInstace<FileRecordModel> {
    constructor(client: IDbClient) {
        super(client, FILE_RECORD_TYPE);
    }
}
