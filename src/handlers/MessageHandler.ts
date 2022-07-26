/* eslint-disable no-mixed-spaces-and-tabs */
/* eslint-disable @typescript-eslint/indent */

import { APIPayment } from '@pinetwork-js/api-typing';
import { MessageType } from '../MessageTypes';
import { APIScopes } from '../PiClient';

interface ShareDialogPayload {
	/**
	 * The title of the shared message
	 */
	title: string;

	/**
	 * The shared message
	 */
	sharingMessage: string;
}

interface ConversationPayload {
	/**
	 * The conversation id
	 */
	conversationId: number;
}

interface PaymentErrorPayload {
	/**
	 * The payment error
	 */
	paymentError: any;
}

interface StartPaymentFlowPayload {
	/**
	 * The payment id
	 */
	paymentId: string;
}

interface OpenConsentModal {
	/**
	 * The requested scopes
	 */
	scopes: APIScopes[];
}

export interface Message<T extends MessageType> {
	/**
	 * The type of the message
	 */
	type: MessageType;

	/**
	 * The payload of the message
	 */
	payload?: T extends MessageType.OPEN_APP_CONVERSATION_WITH_ID
		? ConversationPayload
		: T extends MessageType.OPEN_SHARE_DIALOG_ACTION
		? ShareDialogPayload
		: T extends MessageType.SHOW_PRE_PAYMENT_ERROR
		? PaymentErrorPayload
		: T extends MessageType.START_PAYMENT_FLOW
		? StartPaymentFlowPayload
		: T extends MessageType.OPEN_CONSENT_MODAL
		? OpenConsentModal
		: Record<string, never>;
}

export interface SDKApplicationInformation {
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

type SDKPreparePaymentFlow =
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

interface SDKStartPaymentFlow {
	/**
	 * Whether the payment flow started successfully or not
	 */
	success: boolean;
}

interface SDKTransaction {
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

type SDKOpenConsentModal = {
	/**
	 * Whether or not the user gave his consent for the requested scopes
	 */
	success?: boolean;

	/**
	 * Whether or not the user gave his consent for the requested scopes
	 */
	cancelled?: boolean;
};

export interface SDKMessage<T extends MessageType> {
	/**
	 * The id of the message
	 */
	id: number;

	/**
	 * The payload of the message
	 */
	payload: T extends MessageType.COMMUNICATION_INFORMATION_REQUEST
		? SDKApplicationInformation
		: T extends MessageType.PREPARE_PAYMENT_FLOW
		? SDKPreparePaymentFlow
		: T extends MessageType.START_PAYMENT_FLOW
		? SDKStartPaymentFlow
		: T extends MessageType.WAIT_FOR_TRANSACTION
		? SDKTransaction
		: T extends MessageType.OPEN_CONSENT_MODAL
		? SDKOpenConsentModal
		: Record<string, never>;
}

interface PromiseLike {
	resolve: <T extends MessageType>(message: SDKMessage<T>) => void;
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
	public static sendSDKMessage<M extends Message<M['type']>>(message: M): Promise<SDKMessage<M['type']>> {
		const id = MessageHandler.lastEmittedId++;
		const messageToSend = { id, ...message };
		const hostPlatformURL = MessageHandler.getHostPlatformURL();

		window.parent.postMessage(JSON.stringify(messageToSend), hostPlatformURL);

		return new Promise((resolve: (message: SDKMessage<M['type']>) => void, reject) => {
			MessageHandler.emittedPromises[id] = { resolve, reject };

			setTimeout(() => {
				reject(new Error(`Messaging promise with id ${id} timed out after 60000ms.`));
			}, 6e4);
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
if(typeof window !== 'undefined'){

window.addEventListener('message', (message) => MessageHandler.handleIncomingMessage(message));
}
