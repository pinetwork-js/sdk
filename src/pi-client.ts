import type {
	APIPartialPayment,
	APIPayment,
	APIPaymentNetwork,
	APIUser,
	APIUserScopes,
} from '@pinetwork-js/api-typing';
import { getAuthenticatedUser, trackUsage } from '@pinetwork-js/api-typing';
import type { PaymentCallbacks } from './handlers';
import { MessageHandler, PaymentHandler, RequestHandler } from './handlers';
import { MessageType } from './message-types';

/**
 * Available SDK versions
 */
const versions = ['2.0'] as const;

/**
 * Available Pi Platform API scopes
 */
const availableScopes = new Set(['payments', 'username', 'roles', 'platform', 'wallet_address'] as APIUserScopes[]);

interface ClientInitOptions {
	/**
	 * The version of the SDK
	 */
	version: (typeof versions)[number];

	/**
	 * Whether the application is executed in the Pi Network sandbox
	 */
	sandbox?: boolean;
}

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
	 * The list of scopes consented by the user
	 */
	public consentedScopes: APIUserScopes[] = [];

	/**
	 * The network to which the application is connected
	 */
	public connectedNetwork?: APIPaymentNetwork;

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
	public async init(options: ClientInitOptions): Promise<void> {
		if (!versions.includes(options.version)) {
			throw new Error('Unrecognized version number');
		}

		if (options.sandbox) {
			MessageHandler.setSandboxMode(true);
		}

		this.initTracking();

		this.initialized = true;
		this.connectedNetwork = await this.getConnectedNetwork();
	}

	/**
	 * Authenticate the user
	 *
	 * @param scopes - The list of requested scopes
	 * @param onIncompletePaymentFound - Callback function triggered if an incomplete payment is found
	 * @returns information about the authenticated user
	 */
	public async authenticate(
		scopes: APIUserScopes[],
		onIncompletePaymentFound: (payment: APIPayment) => void,
	): Promise<AuthResult> {
		this.checkInitialized();

		if (!scopes.every((scope) => availableScopes.has(scope))) {
			throw new Error("Invalid scopes found. Please check the scopes you're requesting again.");
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

		this.consentedScopes = user.credentials.scopes;

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
		this.checkInitialized();

		if (!this.consentedScopes.includes('payments')) {
			throw new Error('Cannot create a payment without "payments" scope');
		}

		if (!this.connectedNetwork) {
			throw new Error('Connected network cannot be found');
		}

		return new PaymentHandler(this.connectedNetwork, paymentData, callbacks, this.onIncompletePaymentFound);
	}

	/**
	 * Open the share dialog
	 *
	 * @param title - The title of the message
	 * @param sharingMessage - The message to share
	 */
	public openShareDialog(title: string, sharingMessage: string): void {
		this.checkInitialized();

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
		this.checkInitialized();

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
		this.checkInitialized();

		const nativeFeaturesList = await MessageHandler.sendSDKMessage({ type: MessageType.CHECK_NATIVE_FEATURES });

		if (!nativeFeaturesList) {
			return [];
		}

		return nativeFeaturesList.payload.features;
	}

	/**
	 * Initialize the usage tracking system
	 */
	private initTracking(): void {
		this.api.post(trackUsage, {});

		let lastTrackingRequestTimestamp = Date.now();
		const events = ['click', 'scroll', 'mousemove', 'touchend', 'change'];

		for (const event of events) {
			/* eslint-disable-next-line @typescript-eslint/no-loop-func */
			document.addEventListener(event, () => {
				if (Date.now() - lastTrackingRequestTimestamp < 15_000) {
					return;
				}

				this.api.post(trackUsage, {});

				lastTrackingRequestTimestamp = Date.now();
			});
		}
	}

	/**
	 * Check if the SDK client has been initialized before use
	 */
	private checkInitialized(): void {
		if (this.initialized) {
			return;
		}

		throw new Error('Pi Network SDK was not initialized. Call init() before any other method.');
	}

	/**
	 * Get the network to which the application is connected
	 */
	private async getConnectedNetwork(): Promise<APIPaymentNetwork | undefined> {
		const connectedNetworkMessage = await MessageHandler.sendSDKMessage({ type: MessageType.GET_CONNECT_NETWORK });

		if (!connectedNetworkMessage) {
			return;
		}

		return connectedNetworkMessage.payload.network;
	}
}
