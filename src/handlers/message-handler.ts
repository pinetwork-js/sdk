import type { BaseResponseMessage, MessagePromise, RequestMessage, ResponseMessage } from '../types';
import { PINET_REGEX } from '../util';

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
	public static emittedPromises: Record<number, MessagePromise> = {};

	/**
	 * Whether the application is executed in the Pi Network sandbox
	 */
	private static sandboxMode = false;

	/**
	 * @returns the host platform URL of the application
	 */
	public static getHostPlatformURL(): string {
		if (MessageHandler.sandboxMode) {
			return 'https://sandbox.minepi.com';
		}

		const [, pinetApp] = document.referrer.match(PINET_REGEX) ?? [];

		return pinetApp ? `https://${pinetApp}.pinet.com` : 'https://app-cdn.minepi.com';
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

		console.log(`Sending message to app platform (target origin: ${hostPlatformURL}):`, messageToSend);

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
		let parsedData: BaseResponseMessage = {};

		try {
			if (typeof event.data !== 'string') {
				console.log('Received message with non-string data:', event.data);

				return;
			}

			parsedData = JSON.parse(event.data);

			if (!('id' in parsedData) || parsedData.id === undefined) {
				throw new Error('No id found in message response');
			}

			console.log(`Received response for message id ${parsedData.id}:`, parsedData);

			if (!(parsedData.id in MessageHandler.emittedPromises)) {
				throw new Error(`No emitted promise found for native messaging response id ${parsedData.id}`);
			}

			// @ts-expect-error parsedData.id is not undefined, but it says it is
			MessageHandler.emittedPromises[parsedData.id].resolve(parsedData);
			delete MessageHandler.emittedPromises[parsedData.id];
		} catch (error) {
			console.error(
				`Native messaging: error when handling ${
					parsedData.id === undefined
						? `incoming message (possible response?)`
						: `response for message id ${parsedData.id}`
				}. Error is logged below.`,
			);
			console.error(error);
			console.error(event.data);

			if (parsedData.id && parsedData.id in MessageHandler.emittedPromises) {
				MessageHandler.emittedPromises[parsedData.id].reject(error);
			}
		}
	}
}

if (typeof window !== 'undefined') {
	window.addEventListener('message', (message) => MessageHandler.handleIncomingMessage(message));
}
