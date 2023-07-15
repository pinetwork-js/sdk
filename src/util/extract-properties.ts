/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Extract values from an object giving a list of properties
 *
 * @param initialObject - The object to extract values from
 * @param properties - The list of properties to extract
 * @returns The extracted object
 */
export function extractProperties(initialObject: Record<string, any>, properties: string[]): object {
	const extractedObject: Record<string, unknown> = {};

	for (const property of properties) {
		if (property in initialObject) {
			extractedObject[property] = initialObject[property];
		}
	}

	return extractedObject;
}
