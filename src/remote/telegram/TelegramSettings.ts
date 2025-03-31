export type TelegramSettings = {
    chatName: string;
    appId: number;
    appHash: string;
    session?: string;
    phone: string;
    chatId?: number;
    retries?: number;
};
