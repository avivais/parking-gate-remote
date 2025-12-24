/**
 * Format a timestamp as a relative time string in Hebrew
 * @param timestamp - Unix timestamp in milliseconds or ISO string
 * @returns Hebrew relative time string (e.g., "לפני 2 דקות")
 */
export function formatRelativeTime(timestamp: number | string): string {
    const now = Date.now();
    const time = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
    const diffMs = now - time;
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 60) {
        return 'לפני רגע';
    }

    if (diffMinutes < 60) {
        return `לפני ${diffMinutes} דקות`;
    }

    if (diffHours < 24) {
        return `לפני ${diffHours} שעות`;
    }

    if (diffDays < 7) {
        return `לפני ${diffDays} ימים`;
    }

    // For longer periods, return formatted date
    return new Date(time).toLocaleString('he-IL', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

