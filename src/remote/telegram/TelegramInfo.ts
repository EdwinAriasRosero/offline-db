export type TelegramSettings = {
    chatName: string;
    appId: number;
    appHash: string;
    session?: string;
    phone: string;
    chatId?: number;
};

export class TelegramInfo {
    static saveConfig(x: TelegramSettings) {
        localStorage.setItem('telegram', JSON.stringify(x));
    }

    public static get getConfig(): any {
        const config = JSON.parse(localStorage.getItem('telegram') ?? '{}');
        return config as TelegramInfo;
    }

    static isValid() {
        const settings = TelegramInfo.getConfig;
        return settings && settings.appId && settings.appHash && settings.phone;
    }

    static get chatName(): string {
        return TelegramInfo.getConfig.chatName || '';
    }

    static get appId(): number {
        return TelegramInfo.getConfig.appId || 0;
    }

    static get appHash(): string {
        return TelegramInfo.getConfig.appHash || '';
    }

    static get session(): string {
        return TelegramInfo.getConfig.session || '';
    }

    static get phone(): string {
        return TelegramInfo.getConfig.phone || '';
    }

    static get chatId(): number {
        return TelegramInfo.getConfig.chatId || 0;
    }
}
