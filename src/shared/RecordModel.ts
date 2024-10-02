
export interface RecordModel {
    record_id?: string;
    record_timespan?: number;
    record_isDeleted?: boolean;
    record_type?: string;
    record_user?: string;
    record_user_modified?: string;
    record_file_ref?: string;

    id: string;
    [key: string]: any;
}

export const FILE_RECORD_TYPE = 'record_files';

export interface FileRecordModel extends RecordModel {
    record_file: ArrayBuffer;
    record_file_extension: string;
}