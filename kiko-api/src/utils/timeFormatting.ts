export interface ZonedDateTimeParts {
    year: string;
    month: string;
    day: string;
    hour: string;
    minute: string;
    second: string;
}

export function formatZonedDateTimeParts(date: Date, timeZone: string): ZonedDateTimeParts {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        hourCycle: 'h23',
    });

    const parts = formatter.formatToParts(date);
    const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || '00';
    const rawHour = read('hour');

    return {
        year: read('year'),
        month: read('month'),
        day: read('day'),
        hour: rawHour === '24' ? '00' : rawHour,
        minute: read('minute'),
        second: read('second'),
    };
}

export function formatZonedDateTime(date: Date, timeZone: string): string {
    const parts = formatZonedDateTimeParts(date, timeZone);
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

export function formatZonedIsoLike(date: Date, timeZone: string): string {
    const parts = formatZonedDateTimeParts(date, timeZone);
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}

export const __timeFormattingTestables = {
    formatZonedDateTimeParts,
    formatZonedDateTime,
    formatZonedIsoLike,
};
