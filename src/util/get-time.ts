function padding(number: number): string {
	return String(number).padStart(2, '0');
}

/**
 * Get a formatted current UTC date and time.
 *
 * @returns The formatted current UTC date and time.
 */
export function getDateTime(): string {
	const date = new Date();
	const month = date.getUTCMonth() + 1;
	const day = date.getUTCDate();
	const hours = date.getUTCHours();
	const minutes = date.getUTCMinutes();
	const seconds = date.getUTCSeconds();

	return `${padding(month)}-${padding(day)} ${padding(hours)}:${padding(minutes)}:${padding(seconds)}`;
}
