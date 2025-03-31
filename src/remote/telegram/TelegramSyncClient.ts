import { replacer } from "../../shared/json-utilities";
import { RecordModel, FileRecordModel } from "../../shared/RecordModel";
import { ISyncClient } from "../core/ISyncClient";
import { TelegramInfo } from "./TelegramInfo";
import { TelegramSettings } from "./TelegramSettings";
import { TelegramService } from "./TelegramService";
import './telegram';

declare const telegram: any;
let TelegramClient: any;
let Api: any;
let StringSession: any;

export class TelegramSyncClient implements ISyncClient<TelegramSettings> {

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

        TelegramClient = telegram.TelegramClient;
        Api = telegram.Api;
        StringSession = telegram.sessions.StringSession;
    }

    private async start() {
        try {
            if (!this.currentSettings?.session || !this.currentSettings?.chatName) {
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

    currentSettings?: TelegramSettings;

    async connect(settings: TelegramSettings): Promise<TelegramSettings> {
        if (!TelegramInfo.isValid(settings)) {
            throw new Error('Please check Api connection values (appId, appHash, phone number and chat name)');
        }

        this.currentSettings = settings;

        this.client = new TelegramClient(new StringSession(settings.session),
            Number(settings.appId),
            settings.appHash,
            { connectionRetries: settings.retries ?? 1 });

        //Connect to phone
        let newSession = '';
        try {
            newSession = await this.startAsync(settings.phone);
        } catch (ex) {
            throw new Error('Please check Api connection values (appId, appHash and phone number)');
        }

        //Connect to chat
        const chats = await this.client.getDialogs();
        const chatId = Number(chats.find((x: any) => x.name === settings.chatName)?.id ?? 0);
        if (!chatId || chatId === 0) {
            throw new Error(`Please check chat name exists or you have access '${settings.chatName}'`);
        }

        //Start sync process
        await this.start();
        await this.client.connect();

        this.onConnectionChanges && this.onConnectionChanges(this.isConnected);
        this.reconnectListeners();

        // return newSession;
        return { ...settings, session: newSession, chatId };
    }

    get isConnected() {
        return this.client && this.client.connected;
    }

    async onSync(event: { type: string; data: RecordModel[] }) { };

    private async deleteMessages(item: RecordModel) {
        let fileMessagesIds: string[] = [];

        if ((<FileRecordModel>item).record_file) {
            const serverData = [...(await this.client.getMessages(this.currentSettings?.chatId, {
                search: JSON.stringify({ id: item.id }, replacer)
            }))];
            const fileMessagesList = await Promise.all(serverData.map(async (x) => await this.utils.parseToModel(this.client, this.currentSettings?.chatId, x)));
            const fileMessages = fileMessagesList.filter((x: RecordModel | undefined) => x && x.id === item.id);

            fileMessagesIds = [...fileMessagesIds, ...fileMessages.map(x => x?.record_id), ...fileMessages.map(x => x?.record_file_ref)];
        }

        if (item.record_id) {
            const recordIds = [...await this.client.getMessages(this.currentSettings?.chatId, { ids: [...fileMessagesIds, Number(item.record_id)] })].filter(x => !!x);
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
                const result = await this.client.sendFile(this.currentSettings?.chatId, {
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

        const result = await this.client.sendMessage(this.currentSettings?.chatId, {
            message: this.utils.parseToMessage({ ...newChange, record_file: undefined }),
            silent: true
        });

        return { ...newChange, record_id: result.id, record_timespan: result.date * 1000 };
    }

    async sync(type: string, syncData: RecordModel[], timespan: number) {
        if (!this.isConnected || !this.currentSettings?.chatId || this.currentSettings?.chatId === 0) {
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

        const data = await this.getNewMessages(type, this.currentSettings?.chatId, timespan);
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
                    const message = await this.utils.parseToModel(this.client, this.currentSettings?.chatId, m);

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

                const message = await this.utils.parseToModel(this.client, this.currentSettings?.chatId, event.message);

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
