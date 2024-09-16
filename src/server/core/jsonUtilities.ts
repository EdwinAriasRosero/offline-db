export function replacer(key: string, value: any) {
    if (value instanceof Date) {
        return { __type: 'Date', value: value.toISOString() };
    }
    return value;
}

export function reviver(key: string, value: any) {
    if (value && value.__type === 'Date') {
        return new Date(value.value);
    }
    return value;
}