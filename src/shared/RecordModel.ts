export interface RecordModel {
    record_id?: string;
    record_timespan?: number;
    record_isDeleted?: boolean;
    record_type?: string;
    [key: string]: any;
}