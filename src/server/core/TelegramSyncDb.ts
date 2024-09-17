import { randomUUID } from "crypto";
import { RecordModel } from "../../shared/RecordModel";
import { TelegramClient } from "telegram";
import { Api } from 'telegram/tl';
import ISyncDB from "./ISyncDB";
import { replacer, reviver } from "../../shared/jsonUtilities";

const { StringSession } = require('telegram/sessions');

export class TelegramSyncDb implements ISyncDB {

    private apiId = Number(process.env.TELEGRAM_API_ID);
    private apiHash = process.env.TELEGRAM_API_HASH;
    private chatId: number = 0; //Number(process.env.TELEGRAM_CHAT_ID);
    private chatName = process.env.TELEGRAM_CHAT_NAME;
    private stringSession = process.env.TELEGRAM_STRING_SESSION;

    private client: TelegramClient;

    constructor() {
        if (!this.apiHash) {
            throw new Error('TELEGRAM_API_HASH is not configured');
        }

        if (!this.apiId) {
            throw new Error('TELEGRAM_API_ID is not configured');
        }

        if (!this.stringSession) {
            throw new Error('TELEGRAM_STRING_SESSION is not configured');
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

        this.chatId = Number((await this.client.getDialogs()).find(x => x.name === this.chatName)?.id ?? 0);

        // let clienId = this.client.session.save(); // Save this string to avoid logging in again
    }

    async sync(type: string, syncData: RecordModel[], timespan: number): Promise<{ changes: RecordModel[], syncData: RecordModel[] }> {
        try {
            let changes: RecordModel[] = [];

            syncData.forEach(async (item) => {
                const updatedMessages = await this.client.getMessages(this.chatId, {
                    search: JSON.stringify({ id: item.id }, replacer)
                });

                await this.client.invoke(new Api.messages.DeleteMessages({ id: updatedMessages.map(m => m.id), revoke: true }));

                let newChange = {
                    ...item,
                    record_id: item.record_id ?? randomUUID(),
                    record_timespan: undefined,
                    record_isDeleted: item.record_isDeleted ?? false,
                    record_type: type
                } as RecordModel;
                changes.push(newChange);

                await this.client.sendMessage(this.chatId, {
                    message: JSON.stringify(newChange, replacer),
                    silent: true
                })
            });

            await new Promise(resolve => setTimeout(resolve, 1000)); //await for sever processing new messages

            let data = [... (await this.client.getMessages(this.chatId, { offsetDate: Math.floor(new Date(timespan).getTime() / 1000), reverse: true, }))
                .filter(m => m instanceof Api.Message)
                .map(m => ({ ...JSON.parse(m.message, reviver), record_timespan: m.date * 1000 } as RecordModel))
                .filter(m => m.record_type === type)
            ];

            let changeIds = changes.map(x => x.record_id);

            return {
                changes: data.filter(d => changeIds.includes(d.record_id)),
                syncData: data
            };

        } catch (error) {
            console.log("Error in Telegram", error);
            return {
                changes: [],
                syncData: []
            };
        }
    }

}

