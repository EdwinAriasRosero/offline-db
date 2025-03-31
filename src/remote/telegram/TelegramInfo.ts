import { TelegramSettings } from "./TelegramSettings";

export class TelegramInfo {
    static isValid(settings: TelegramSettings) {
        return settings && settings.appId && settings.appHash && settings.phone && settings.chatName;
    }
}
