import { reviver, replacer } from "../../shared/json-utilities";
import { RecordModel, FILE_RECORD_TYPE, FileRecordModel } from "../../shared/RecordModel";
import { ISyncClient } from "../core/ISyncClient";
import { TelegramInfo, TelegramSettings } from "./TelegramInfo";
import './telegram';

declare const telegram: any;
const TelegramClient = telegram.TelegramClient;
const Api = telegram.Api;
const StringSession = telegram.sessions.StringSession;


export class TelegramService {

    async parseToModel(client: any, message: any) {
        try {
            const record = JSON.parse(message.message, reviver) as RecordModel;
            let buffer: any = undefined;

            if (record.record_type === FILE_RECORD_TYPE && record.record_file_ref) {
                const fileMessage = (await client.getMessages(TelegramInfo.chatId, { ids: [record.record_file_ref] }))[0];

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

export class TelegramSyncClient implements ISyncClient {

    client: any;

    async startAsync(phone: string) {
        return new Promise<string>(async (res, rej) => {
            await this.client.start({
                phoneNumber: async () => phone,
                password: async () => prompt('Please enter your password:'),
                phoneCode: async () => prompt('Please enter your code:'),
                onError: (err: any) => rej(err),
            });

            res(this.client.session.save());
        })
    }

    async auth(infoSettings: TelegramSettings, retries: number = 1) {

        if (infoSettings) {
            TelegramInfo.saveConfig(infoSettings);
        }

        if (!TelegramInfo.isValid()) {
            throw new Error('Please check Api connection values (appId, appHash, phone number and chat name)');
        }

        this.client = new TelegramClient(new StringSession(infoSettings.session), Number(infoSettings.appId), infoSettings.appHash, { connectionRetries: retries });

        //Connect to phone
        let newSession = '';
        try {
            newSession = await this.startAsync(infoSettings.phone);

            TelegramInfo.saveConfig({
                ...infoSettings,
                session: newSession
            });
        } catch (ex) {
            throw new Error('Please check Api connection values (appId, appHash and phone number)');
        }

        //Connect to chat
        let chatId = Number((await this.client.getDialogs()).find((x: any) => x.name === TelegramInfo.chatName)?.id ?? 0);
        if (!chatId || chatId === 0) {
            throw new Error(`Please check chat name exists or you have access '${TelegramInfo.chatName}'`);
        }
        TelegramInfo.saveConfig({
            ...infoSettings,
            session: newSession,
            chatId: chatId
        });

        //Start sync process
        await this.start();
        await this.client.connect();

        this.onConnectionChanges && this.onConnectionChanges(this.isConnected);
        this.reconnectListeners();

        return newSession;
    }

    private async handleOnline() {
        await this.client.connect();
        this.onConnectionChanges && this.onConnectionChanges(this.isConnected);
    }

    private async handleOffline() {
        await this.client.disconnect();
        this.onConnectionChanges && this.onConnectionChanges(false);
    }

    reconnectListeners() {
        window.removeEventListener('online', this.handleOnline);
        window.removeEventListener('offline', this.handleOffline);
        window.addEventListener('online', this.handleOnline);
        window.addEventListener('offline', this.handleOffline);
    }

    private utils: TelegramService;

    constructor(private onConnectionChanges: (isConnected: boolean) => void) {

        this.handleOnline = this.handleOnline.bind(this);
        this.handleOffline = this.handleOffline.bind(this);

        this.utils = new TelegramService();
        this.start();
    }

    private async start() {
        try {
            if (!TelegramInfo.session || !TelegramInfo.chatName) {
                return;
            }

            if (this.client) {
                this.subscribeNewChanges();
                this.onConnectionChanges && this.onConnectionChanges(this.isConnected);
            }

        } catch (error) {
            console.log(error);
        }
    }

    connect() {
        this.auth(TelegramInfo.getConfig);
    }

    get isConnected() {
        return this.client && this.client.connected;
    }

    async onSync(event: { type: string; data: RecordModel[] }) { };

    private async deleteMessages(item: RecordModel) {
        let fileMessagesIds: string[] = [];

        if ((<FileRecordModel>item).record_file) {
            const serverData = [...(await this.client.getMessages(TelegramInfo.chatId, {
                search: JSON.stringify({ id: item.id }, replacer)
            }))];
            const fileMessagesList = await Promise.all(serverData.map(async (x) => await this.utils.parseToModel(this.client, x)));
            const fileMessages = fileMessagesList.filter((x: RecordModel | undefined) => x && x.id === item.id);

            fileMessagesIds = [...fileMessagesIds, ...fileMessages.map(x => x?.record_id), ...fileMessages.map(x => x?.record_file_ref)];
        }

        if (item.record_id) {
            const recordIds = [...await this.client.getMessages(TelegramInfo.chatId, { ids: [...fileMessagesIds, Number(item.record_id)] })].filter(x => !!x);
            fileMessagesIds = [fileMessagesIds, ...[...recordIds].map(x => x.id)];
        }

        await this.client.invoke(new Api.messages.DeleteMessages({ id: fileMessagesIds, revoke: true }));
    }

    private async attachFile(item: RecordModel) {
        let fileRef: string | undefined = undefined;
        if ((<FileRecordModel>item).record_file) {

            const fileItem = <FileRecordModel>item;
            const arrayBuffer = fileItem.record_file;
            const fileSize = arrayBuffer.byteLength;
            const toUpload = new telegram.client.uploads.CustomFile(`${(new Date()).getTime()}.${fileItem.record_file_extension}`, fileSize, item.id, arrayBuffer)

            try {
                const result = await this.client.sendFile(TelegramInfo.chatId, {
                    file: toUpload,
                    workers: 1,
                });

                fileRef = result.id;
            } catch {
                //CHECK WHEN ERROR UPLOADING IMAGE
            }
        }

        return fileRef;
    }

    private async addNewMessage(type: string, item: RecordModel, userName: string, fileRef?: string) {

        const newChange = {
            ...item,
            record_id: item.record_id,
            record_timespan: undefined,
            record_isDeleted: item.record_isDeleted ?? false,
            record_type: type,
            record_user: item.record_user || userName,
            record_user_modified: userName,
            record_file_ref: fileRef
        } as RecordModel;

        const result = await this.client.sendMessage(TelegramInfo.chatId, {
            message: this.utils.parseToMessage({ ...newChange, record_file: undefined }),
            silent: true
        });

        return { ...newChange, record_id: result.id, record_timespan: result.date * 1000 };
    }

    async sync(type: string, syncData: RecordModel[], timespan: number) {
        if (!this.isConnected || !TelegramInfo.chatId || TelegramInfo.chatId === 0) {
            await this.onSync({ type, data: syncData });
            return;
        }

        const userT = await this.client.getMe();
        const user = `${userT.lastName} ${userT.firstName}`

        await Promise.all(syncData.map(async (item: RecordModel) => {
            await this.deleteMessages(item);
            const fileRef = await this.attachFile(item);
            await this.addNewMessage(type, item, user, fileRef);
        }));

        const data = await this.getNewMessages(type, TelegramInfo.chatId, timespan);
        if (data.length > 0) {
            await this.onSync({ type, data });
        }
    };

    private async getNewMessages(type: string, chatId: number, timespan: number) {
        const messages = await this.client.getMessages(chatId, {
            offsetDate: Math.floor(new Date(timespan).getTime() / 1000) + 1,
            reverse: true
        });

        const data = ((await Promise.all(
            [...messages]
                .filter((m: any) => m instanceof Api.Message)
                .map(async (m: any) => {
                    const message = await this.utils.parseToModel(this.client, m);

                    if (message) {
                        return {
                            ...message,
                            record_timespan: m.date * 1000,
                            record_id: m.id
                        };

                    }

                    return undefined;
                })))
            .filter((m: RecordModel | undefined) => !!m) as RecordModel[])
            .filter((m: RecordModel) => m.record_type === type);

        return data;
    }

    private subscribeNewChanges() {
        this.client?.addEventHandler(async (event: any) => {

            if (["UpdateNewMessage"].includes(event.className)) {

                const message = await this.utils.parseToModel(this.client, event.message);

                if (message) {
                    await this.onSync({
                        type: message.record_type!,
                        data: [message]
                    });
                }
            }
        });

    }
}
