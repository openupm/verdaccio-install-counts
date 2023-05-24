export const ERR_MESSAGE_INVALID_DATE_RANGE = 'Invalid date range error';

export class InvalidDateRangeError extends Error {
    public code: number;

    constructor(message: string = ERR_MESSAGE_INVALID_DATE_RANGE) {
        super(message);
        this.name = "InvalidDateRangeError";
        this.code = 400;
    }
}
