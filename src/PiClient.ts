import { APIPartialPayment, APIPayment, APIUser, routes } from '@pinetwork-js/api-typing';
import { MessageHandler, SDKMessage } from './handlers/MessageHandler';
import { PaymentCallbacks, PaymentHandler } from './handlers/PaymentHandler';
import { RequestHandler } from './handlers/RequestHandler';
import { MessageType } from './MessageTypes';

/**
 * Available SDK versions
 */
const versions = ['2.0'] as const;

interface InitParameters {
	/**
	 * The version of the SDK
	 */
	version: typeof versions[number];
}

/**
 * Available API scopes
 */
type APIScopes = ['username', 'payments'];

interface AuthResult {
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
	 * @param param0 - Information to initialize the SDK
	 */
	public init({ version }: InitParameters): void {
		if (!versions.includes(version)) {
			throw new Error('Unrecognized version number');
		}

		this.initialized = true;
	}

	/**
	 * Authenticate the user
	 *
	 * @param scopes - A list of scopes (not yet implemented)
	 * @param onIncompletePaymentFound - Callback function triggered if an incomplete payment is found
	 * @returns information about the authenticated user
	 */
	public async authenticate(
		scopes: APIScopes,
		onIncompletePaymentFound: (payment: APIPayment) => void,
	): Promise<AuthResult | void> {
		if (!this.initialized) {
			throw new Error('Pi Network SDK was not initialized. Call init() before any other method.');
		}

		let applicationInformationMessage: SDKMessage<MessageType.SDK_COMMUNICATION_INFORMATION_REQUEST>;

		try {
			applicationInformationMessage = await MessageHandler.sendSDKMessage({
				type: MessageType.SDK_COMMUNICATION_INFORMATION_REQUEST,
			});
		} catch {
			return;
		}

		const applicationInformation = applicationInformationMessage.payload;

		this.api.init(applicationInformation);

		this.onIncompletePaymentFound = onIncompletePaymentFound;

		let user: APIUser | undefined;

		try {
			user = await this.api.get(routes.getAuthenticatedUser);
		} catch {
			throw new Error('Authentication failed.');
		}

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
}
