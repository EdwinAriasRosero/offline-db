import { reviver, replacer } from "../../shared/json-utilities";
import { RecordModel, FILE_RECORD_TYPE } from "../../shared/RecordModel";

export class TelegramService {

    async parseToModel(client: any, chatId: number | undefined, message: any) {
        if (!chatId) {
            return undefined;
        }

        try {
            const record = JSON.parse(message.message, reviver) as RecordModel;
            let buffer: any = undefined;

            if (record.record_type === FILE_RECORD_TYPE && record.record_file_ref) {
                const fileMessage = (await client.getMessages(chatId, { ids: [record.record_file_ref] }))[0];

                if (fileMessage) {
                    buffer = await client.downloadMedia(fileMessage.media);
                }
            }

            return {
                ...record,
                record_id: message.id,
                record_file: buffer,
                record_timespan: message.date * 1000
            };
        }
        catch (error) {
            return undefined;
        }
    }

    parseToMessage(record: RecordModel) {
        return JSON.stringify(structuredClone(record), replacer);
    }
}
