export function replacer(key: string, value: any): any {
    if (value instanceof Date) {
        return { __type: 'Date', value: value.toISOString() };
    }
    if (value && typeof value === 'object') {
        if (Array.isArray(value)) {
            return value.map(item => replacer(key, item));
        }
        for (const k in value) {
            if (value.hasOwnProperty(k)) {
                value[k] = replacer(k, value[k]);
            }
        }
    }
    return value;
}

export function reviver(key: string, value: any): any {
    if (value && value.__type === 'Date') {
        return new Date(value.value);
    }
    if (value && typeof value === 'object') {
        if (Array.isArray(value)) {
            return value.map(item => reviver(key, item));
        }
        for (const k in value) {
            if (value.hasOwnProperty(k)) {
                value[k] = reviver(k, value[k]);
            }
        }
    }
    return value;
}
