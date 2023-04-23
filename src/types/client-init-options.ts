import type { versions } from '../pi-client';

export interface ClientInitOptions {
	/**
	 * The version of the SDK
	 */
	version: (typeof versions)[number];

	/**
	 * Whether the application is executed in the Pi Network sandbox
	 */
	sandbox?: boolean;
}
