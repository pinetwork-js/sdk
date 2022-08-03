import type { APIPayment } from '@pinetwork-js/api-typing/payloads';
import type { MessageType } from '../message-types';
import type { APIScopes } from '../pi-client';

interface OpenShareDialogRequestPayload {
	/**
	 * The title of the shared message
	 */
	title: string;

	/**
	 * The shared message
	 */
	sharingMessage: string;
}

interface OpenAppConversationRequestPayload {
	/**
	 * The conversation id
	 */
	conversationId: number;
}

export type Network = 'Pi Network' | 'Pi Testnet';

interface PreparePaymentFlowRequestPayload {
	/**
	 * The network to which the application is connected
	 */
	connectedNetwork: Network;
}

interface ShowPrePaymentErrorRequestPayload {
	/**
	 * The payment error
	 */
	paymentError: any;
}

interface StartPaymentFlowRequestPayload {
	/**
	 * The payment id
	 */
	paymentId: string;
}

interface OpenConsentModalRequestPayload {
	/**
	 * The requested scopes
	 */
	scopes: APIScopes[];
}

export type PaymentStatus = 'developerApproved' | 'developerCompleted';

interface DecidalCallbackRetrialRequestPayload {
	/**
	 * The status of the payment concerned by the retry request
	 */
	targetStatus: PaymentStatus;
}

type RequestMessagePayload<T extends MessageType> = T extends MessageType.OPEN_APP_CONVERSATION_WITH_ID
	? OpenAppConversationRequestPayload
	: T extends MessageType.OPEN_SHARE_DIALOG_ACTION
	? OpenShareDialogRequestPayload
	: T extends MessageType.PREPARE_PAYMENT_FLOW
	? PreparePaymentFlowRequestPayload
	: T extends MessageType.SHOW_PRE_PAYMENT_ERROR
	? ShowPrePaymentErrorRequestPayload
	: T extends MessageType.START_PAYMENT_FLOW
	? StartPaymentFlowRequestPayload
	: T extends MessageType.OPEN_CONSENT_MODAL
	? OpenConsentModalRequestPayload
	: T extends MessageType.DECIDE_CALLBACK_RETRIAL
	? DecidalCallbackRetrialRequestPayload
	: void;

interface BaseRequestMessage {
	/**
	 * The type of the message
	 */
	type: MessageType;
}

export type RequestMessage<T extends MessageType> = RequestMessagePayload<T> extends void
	? BaseRequestMessage
	: BaseRequestMessage & {
			/**
			 * The payload of the message
			 */
			payload: RequestMessagePayload<T>;
	  };

export interface CommunicationInformationResponsePayload {
	/**
	 * The application access token
	 */
	accessToken: string;

	/**
	 * The application backend url
	 */
	backendURL: string;

	/**
	 * The application frontend url
	 */
	frontendURL: string;
}

type PreparePaymentFlowResponsePayload =
	| {
			/**
			 * Whether there is a pending transaction or not
			 */
			pending: false;
	  }
	| {
			/**
			 * Whether there is a pending transaction or not
			 */
			pending: true;

			/**
			 * The pending transaction
			 */
			pendingPayment: APIPayment;
	  };

interface StartPaymentFlowResponsePayload {
	/**
	 * Whether the payment flow started successfully or not
	 */
	success: boolean;
}

interface WaitForTransactionResponsePayload {
	/**
	 * Whether the transaction has been cancelled or not
	 */
	cancelled: boolean;

	/**
	 * The payment id
	 */
	paymentId: string;

	/**
	 * The transaction id
	 */
	txid: string;
}

interface OpenConsentModalResponsePayload {
	/**
	 * Whether or not the user gave his consent for the requested scopes
	 */
	success?: boolean;

	/**
	 * Whether or not the user gave his consent for the requested scopes
	 */
	cancelled?: boolean;
}

type NativeFeature = 'inline_media';

interface CheckNativeFeaturesResponsePayload {
	/**
	 * List of native features available in client platform
	 */
	features: NativeFeature[];
}

interface DecidalCallbackRetrialResponsePayload {
	/**
	 * Whether or not a retry has been granted
	 */
	retry: boolean;
}

interface GetConnectNetworkResponsePayload {
	/**
	 * The network to which the application is connected
	 */
	network: Network;
}

type ResponseMessagePayload<T extends MessageType> = T extends MessageType.COMMUNICATION_INFORMATION_REQUEST
	? CommunicationInformationResponsePayload
	: T extends MessageType.PREPARE_PAYMENT_FLOW
	? PreparePaymentFlowResponsePayload
	: T extends MessageType.START_PAYMENT_FLOW
	? StartPaymentFlowResponsePayload
	: T extends MessageType.WAIT_FOR_TRANSACTION
	? WaitForTransactionResponsePayload
	: T extends MessageType.OPEN_CONSENT_MODAL
	? OpenConsentModalResponsePayload
	: T extends MessageType.CHECK_NATIVE_FEATURES
	? CheckNativeFeaturesResponsePayload
	: T extends MessageType.DECIDE_CALLBACK_RETRIAL
	? DecidalCallbackRetrialResponsePayload
	: T extends MessageType.GET_CONNECT_NETWORK
	? GetConnectNetworkResponsePayload
	: void;

interface BaseResponseMessage {
	/**
	 * The id of the message
	 */
	id: number;
}

export type ResponseMessage<T extends MessageType> = ResponseMessagePayload<T> extends void
	? BaseResponseMessage
	: BaseResponseMessage & {
			/**
			 * The payload of the message
			 */
			payload: ResponseMessagePayload<T>;
	  };

interface PromiseLike {
	resolve: <T extends MessageType>(message: ResponseMessage<T>) => void;
	reject: (reason?: any) => void;
}

/**
 * Handler for messages
 */
export class MessageHandler {
	/**
	 * Last emitted message id
	 */
	public static lastEmittedId = 0;

	/**
	 * A list of emitted promises
	 */
	public static emittedPromises: Record<number, PromiseLike> = {};

	/**
	 * Whether the application is executed in the Pi Network sandbox
	 */
	private static sandboxMode = false;

	/**
	 * @returns the host platform URL of the application
	 */
	public static getHostPlatformURL(): string {
		return MessageHandler.sandboxMode ? 'https://sandbox.minepi.com' : 'https://app-cdn.minepi.com';
	}

	/**
	 * @param sandboxMode - True if in sandbox, false otherwhise
	 */
	public static setSandboxMode(sandboxMode: boolean): void {
		MessageHandler.sandboxMode = sandboxMode;
	}

	/**
	 * Send a message to the Pi Network hosting page
	 *
	 * @param message - The message to send
	 * @returns the message returned by the Pi Network hosting page
	 */
	public static sendSDKMessage<M extends RequestMessage<M['type']>>(
		message: M,
	): Promise<ResponseMessage<M['type']> | undefined> {
		const id = MessageHandler.lastEmittedId++;
		const messageToSend = { id, ...message };
		const hostPlatformURL = MessageHandler.getHostPlatformURL();

		window.parent.postMessage(JSON.stringify(messageToSend), hostPlatformURL);

		return new Promise((resolve: (message: ResponseMessage<M['type']>) => void, reject) => {
			MessageHandler.emittedPromises[id] = { resolve, reject };

			setTimeout(() => {
				console.error(`Messaging promise with id ${id} timed out after 120000ms.`);

				reject();
			}, 120_000);
		});
	}

	/**
	 * Handle message events
	 *
	 * @param event - The message event received
	 */
	public static handleIncomingMessage(event: MessageEvent): void {
		let parsedData: any;

		try {
			parsedData = JSON.parse(event.data);

			if (parsedData.id === null) {
				throw new Error('No id found in message response');
			}

			if (!(parsedData.id in MessageHandler.emittedPromises)) {
				throw new Error(`No emitted promise found for native messaging response id ${parsedData.id}`);
			}

			MessageHandler.emittedPromises[parsedData.id].resolve(parsedData);
			delete MessageHandler.emittedPromises[parsedData.id];
		} catch (error) {
			if (parsedData.id === null) {
				console.error(
					// eslint-disable-next-line max-len
					'Native messaging: error when handling incoming message (possible response?). Error is logged below.',
				);
				console.error(error);
				console.error(event.data);

				return;
			}

			console.error(
				`Native messaging: error when handling response for message id ${parsedData.id}. Error is logged below.`,
			);
			console.error(error);
			console.error(event.data);

			if (parsedData.id in MessageHandler.emittedPromises) {
				MessageHandler.emittedPromises[parsedData.id].reject(error);
			}
		}
	}
}

window.addEventListener('message', (message) => MessageHandler.handleIncomingMessage(message));
