import {
	type APIPartialPayment,
	type APIPayment,
	type APIUserScopes,
	getAuthenticatedUser,
	trackUsage,
} from '@pinetwork-js/api-typing';
import { MessageHandler, PaymentHandler, RequestHandler } from './handlers';
import { MessageType } from './message-types';
import type { AuthResult, ClientInitOptions, PaymentCallbacks, Permission } from './types';

/**
 * Available SDK versions
 */
export const versions = ['2.0'] as const;

/**
 * Available Pi Platform API scopes
 */
const availableScopes = new Set<APIUserScopes>([
	'payments',
	'username',
	'roles',
	'platform',
	'wallet_address',
	'preferred_language',
]);

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

		return new PaymentHandler(paymentData, callbacks, this.onIncompletePaymentFound);
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
	 * Copy given text to user clipboard
	 *
	 * @param text - The text to copy
	 */
	public async copyText(text: string) {
		this.checkInitialized();

		await MessageHandler.sendSDKMessage({ type: MessageType.COPY_TEXT_FROM_TPA, payload: { text } });
	}

	/**
	 * Request for a permission to the user
	 *
	 * @param permission - The permission to request
	 * @returns Whether or not the requested permission has been granted
	 */
	public async requestPermission(permission: Permission) {
		this.checkInitialized();

		const requestPermissionResponse = await MessageHandler.sendSDKMessage({
			type: MessageType.REQUEST_NATIVE_PERMISSION,
			payload: { permission },
		});

		return !!requestPermissionResponse?.payload.granted;
	}

	/**
	 * Open the given url in system browser
	 *
	 * @param url - The url to open
	 */
	public async openUrlInSystemBrowser(url: string) {
		this.checkInitialized();

		const openUrlInSystemBrowserResponse = await MessageHandler.sendSDKMessage({
			type: MessageType.OPEN_URL_IN_SYSTEM_BROWSER,
			payload: { url },
		});

		if (!openUrlInSystemBrowserResponse) {
			throw new Error('Unexpected error');
		}

		if (!openUrlInSystemBrowserResponse.payload.success) {
			throw new Error(openUrlInSystemBrowserResponse.payload.message);
		}
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
}
