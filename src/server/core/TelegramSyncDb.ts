import { randomUUID } from "crypto";
import { RecordModel } from "../RecordModel";
import { TelegramClient } from "telegram";
import { Api } from 'telegram/tl';
import ISyncDB from "./ISyncDB";

const { StringSession } = require('telegram/sessions');

export class TelegramSyncDb implements ISyncDB {

    private apiId = Number(process.env.TELEGRAM_API_ID);
    private apiHash = process.env.TELEGRAM_API_HASH;
    private chatId: number = Number(process.env.TELEGRAM_CHAT_ID);
    private stringSession = process.env.TELEGRAM_STRING_SESSION;

    private client: TelegramClient;

    constructor() {
        if (!this.apiHash) {
            throw new Error('TELEGRAM_API_HASH is not configured');
        }

        this.client = new TelegramClient(new StringSession(this.stringSession), this.apiId, this.apiHash, { connectionRetries: 5 });
        this.start();

    }

    async start() {
        await this.client.start({
            phoneNumber: async () => '',
            password: async () => '',
            phoneCode: async () => '',
            onError: (err) => console.log(err),
        });
        // let clienId = this.client.session.save(); // Save this string to avoid logging in again
    }

    async sync(type: string, syncData: RecordModel[], timespan: number): Promise<RecordModel[]> {

        syncData.forEach(async (item) => {
            const updatedMessages = await this.client.getMessages(this.chatId, {
                search: JSON.stringify({ id: item.id })
            });

            await this.client.invoke(new Api.messages.DeleteMessages({ id: updatedMessages.map(m => m.id), revoke: true }));

            await this.client.sendMessage(this.chatId, {
                message: JSON.stringify({
                    ...item,
                    record_id: item.record_id ?? randomUUID(),
                    record_timespan: undefined,
                    record_isDeleted: item.record_isDeleted ?? false,
                    record_type: type
                }),
                silent: true
            })
        });

        await new Promise(resolve => setTimeout(resolve, 1000)); //await for sever processing new messages


        return [... (await this.client.getMessages(this.chatId, { offsetDate: Math.floor(new Date(timespan).getTime() / 1000), reverse: true, }))
            .filter(m => m instanceof Api.Message)
            .map(m => ({ ...JSON.parse(m.message), record_timespan: m.date * 1000 }))
            .filter(m => m.record_type === type)
        ];
    }

}