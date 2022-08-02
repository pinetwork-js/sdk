import type { APIPartialPayment, APIPayment, APIUser } from '@pinetwork-js/api-typing/payloads';
import { getAuthenticatedUser } from '@pinetwork-js/api-typing/routes';
import type { PaymentCallbacks } from './handlers';
import { MessageHandler, PaymentHandler, RequestHandler } from './handlers';
import { MessageType } from './message-types';

/**
 * Available SDK versions
 */
const versions = ['2.0'] as const;

interface ClientInitOptions {
	/**
	 * The version of the SDK
	 */
	version: typeof versions[number];

	/**
	 * Whether the application is executed in the Pi Network sandbox
	 */
	sandbox?: boolean;
}

/**
 * Available API scopes
 */
export type APIScopes = 'payments' | 'roles' | 'username';

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

/**
 * Main class of the SDK
 */
export class PiClient {
	/**
	 * Whether the SDK is ready to be used or not
	 */
	public initialized = false;

	/**
	 * The request handler for API requests
	 */
	public api = RequestHandler.getInstance();

	/**
	 * Callback function triggered if an incomplete payment is found during the process of
	 * authentication or payment creation
	 */
	public onIncompletePaymentFound!: (payment: APIPayment) => void;

	/**
	 * Initialize the SDK
	 *
	 * @param options - Options to initialize the SDK
	 */
	public init(options: ClientInitOptions): void {
		if (!versions.includes(options.version)) {
			throw new Error('Unrecognized version number');
		}

		if (options.sandbox) {
			MessageHandler.setSandboxMode(true);
		}

		this.initialized = true;
	}

	/**
	 * Authenticate the user
	 *
	 * @param scopes - The list of requested scopes
	 * @param onIncompletePaymentFound - Callback function triggered if an incomplete payment is found
	 * @returns information about the authenticated user
	 */
	public async authenticate(
		scopes: APIScopes[],
		onIncompletePaymentFound: (payment: APIPayment) => void,
	): Promise<AuthResult> {
		if (!this.initialized) {
			throw new Error('Pi Network SDK was not initialized. Call init() before any other method.');
		}

		const scopeConsentResult = await MessageHandler.sendSDKMessage({
			type: MessageType.OPEN_CONSENT_MODAL,
			payload: {
				scopes,
			},
		});

		if (!scopeConsentResult || scopeConsentResult.payload.cancelled) {
			throw new Error('User consent cancelled.');
		}

		const applicationInformationMessage = await MessageHandler.sendSDKMessage({
			type: MessageType.COMMUNICATION_INFORMATION_REQUEST,
		});

		if (!applicationInformationMessage) {
			throw new Error('Authentication failed.');
		}

		const applicationInformation = applicationInformationMessage.payload;

		this.api.init(applicationInformation);

		this.onIncompletePaymentFound = onIncompletePaymentFound;

		const user = await this.api.get(getAuthenticatedUser);

		if (!user || !this.api.accessToken) {
			throw new Error('Authentication failed.');
		}

		PaymentHandler.checkForPendingPayment(onIncompletePaymentFound);

		return { user, accessToken: this.api.accessToken };
	}

	/**
	 * Create a payment
	 *
	 * @param paymentData - The information about the payment
	 * @param callbacks - Callback functions for the payment process
	 * @returns the payment handler for the created payment
	 */
	public createPayment(paymentData: APIPartialPayment, callbacks: PaymentCallbacks): PaymentHandler {
		if (!this.initialized) {
			throw new Error('Pi Network SDK was not initialized. Call init() before any other method.');
		}

		return new PaymentHandler(paymentData, callbacks, this.onIncompletePaymentFound);
	}

	/**
	 * Open the share dialog
	 *
	 * @param title - The title of the message
	 * @param sharingMessage - The message to share
	 */
	public openShareDialog(title: string, sharingMessage: string): void {
		if (!this.initialized) {
			throw new Error('Pi Network SDK was not initialized. Call init() before any other method.');
		}

		MessageHandler.sendSDKMessage({
			type: MessageType.OPEN_SHARE_DIALOG_ACTION,
			payload: { title, sharingMessage },
		});
	}

	/**
	 * Open a conversation
	 *
	 * @param conversationId - The conversation id
	 */
	public openConversation(conversationId: number): void {
		if (!this.initialized) {
			throw new Error('Pi Network SDK was not initialized. Call init() before any other method.');
		}

		MessageHandler.sendSDKMessage({
			type: MessageType.OPEN_APP_CONVERSATION_WITH_ID,
			payload: { conversationId },
		});
	}

	/**
	 * Get the list of the native feature available in client platform
	 *
	 * @returns the list of native features available in client platform
	 */
	public async nativeFeaturesList() {
		if (!this.initialized) {
			throw new Error('Pi Network SDK was not initialized. Call init() before any other method.');
		}

		const nativeFeaturesList = await MessageHandler.sendSDKMessage({ type: MessageType.CHECK_NATIVE_FEATURES });

		if (!nativeFeaturesList) {
			return [];
		}

		return nativeFeaturesList.payload.features;
	}
}
