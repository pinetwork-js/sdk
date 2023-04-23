import type { APIUser } from '@pinetwork-js/api-typing';

export interface AuthResult {
	/**
	 * The application access token
	 */
	accessToken: string;

	/**
	 * The authenticated user
	 */
	user: APIUser;
}
