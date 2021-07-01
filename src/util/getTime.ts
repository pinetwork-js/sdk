const dateOptions = {
	day: '2-digit',
	month: '2-digit',
} as const;

const timeOptions = {
	hour12: false,
	hour: '2-digit',
	minute: '2-digit',
	second: '2-digit',
} as const;

/**
 * Get a formatted current date and time
 *
 * @returns the formatted current date and time
 */
export function getDateTime(): string {
	const date = new Date();
	const localeDate = date.toLocaleDateString('en-US', {
		...timeOptions,
		...dateOptions,
	});

	return localeDate.replace('/', '-').replace(',', '');
}
