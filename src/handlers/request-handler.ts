import { type Route, type RoutePayload, type RouteResult, postNetworkError } from '@pinetwork-js/api-typing';
import axios, { type AxiosError, type AxiosInstance, type RawAxiosRequestConfig } from 'axios';
import { MessageType } from '../message-types';
import { DEBUG, getDateTime } from '../util';
import type { CommunicationInformationResponsePayload, RequestMessage } from '../types';

/**
 * Handler for requests
 */
export class RequestHandler {
	/**
	 * Singleton instance of the class
	 */
	public static instance?: RequestHandler;

	/**
	 * The application access token
	 */
	public accessToken?: string;

	/**
	 * The application backend url
	 */
	public backendURL?: string;

	/**
	 * The application frontend url
	 */
	public frontendURL?: string;

	/**
	 * The axios client for the requests
	 */
	public axiosClient?: AxiosInstance;

	private constructor() {
		RequestHandler.instance = this;
	}

	/**
	 * Get options for axios API requests
	 *
	 * @returns The API request options
	 */
	public get options(): RawAxiosRequestConfig {
		return {
			headers: this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {},
		};
	}

	/**
	 * Get the instance of the request handler or create a new one if not found
	 *
	 * @returns the instance of the request handler
	 */
	public static getInstance(): RequestHandler {
		return RequestHandler.instance ?? new RequestHandler();
	}

	/**
	 * Initialize the request handler
	 *
	 * @param applicationInformation - The application information
	 */
	public init(applicationInformation: CommunicationInformationResponsePayload): void {
		this.accessToken = applicationInformation.accessToken;
		this.backendURL = applicationInformation.backendURL;
		this.frontendURL = applicationInformation.frontendURL;

		this.createAxios();
	}

	/**
	 * Handle axios request error
	 *
	 * @param error - The error of an Axios request
	 */
	public handleError(error: AxiosError): void {
		const errorCode = error.response?.status;

		if (DEBUG) {
			console.error(error);
		}

		this.sendMessageToPiNetwork({
			type: errorCode !== 401 && errorCode !== 403 ? MessageType.UNKNOWN_ERROR : MessageType.AUTH_ERROR,
		});
	}

	/**
	 * Perform a GET API request with the axios client
	 *
	 * @param route - The URL of the GET request
	 * @returns The result of the request if no error occurred
	 */
	public async get<T extends Route<unknown>>(route: T): Promise<RouteResult<T> | undefined> {
		if (!this.axiosClient) {
			return;
		}

		try {
			const { data } = await this.axiosClient.get(route, this.options);

			return data;
		} catch (error) {
			if (this.isAxiosError(error)) {
				this.handleError(error);

				throw error;
			}
		}
	}

	/**
	 * Perform a POST API request with the axios client
	 *
	 * @param route - The URL of the GET request
	 * @param payload - The data to post
	 * @returns The result of the request if no error occurred
	 */
	public async post<T extends Route<unknown>>(route: T, payload: RoutePayload<T>): Promise<RouteResult<T> | undefined> {
		if (!this.axiosClient) {
			return;
		}

		try {
			const { data } = await this.axiosClient.post(route, payload, this.options);

			return data;
		} catch (error) {
			if (this.isAxiosError(error)) {
				this.handleError(error);

				throw error;
			}
		}
	}

	/**
	 * Send a message to the Pi Network hosting page
	 *
	 * @param message - The message to send
	 */
	public sendMessageToPiNetwork<M extends RequestMessage<M['type']>>(message: M): void {
		if (!this.frontendURL) {
			return;
		}

		window.parent.postMessage(JSON.stringify(message), this.frontendURL);
	}

	/**
	 * Wait for a specific message of the Pi Network hosting page
	 *
	 * @param awaitedMessage - The awaited message
	 * @returns The expected message if received before timeout
	 */
	public waitForAction<M extends RequestMessage<M['type']>>(awaitedMessage: M): Promise<M> {
		return new Promise((resolve, reject) => {
			if (DEBUG) {
				console.log('Waiting for action...');
			}

			const timeout = window.setTimeout(() => {
				reject(new Error('timeout'));
			}, 60_000);

			window.addEventListener('message', (event) => {
				const data = this.handlePiNetworkMessage(event, awaitedMessage);

				if (!data) {
					return;
				}

				window.clearTimeout(timeout);

				resolve(data);
			});
		});
	}

	/**
	 * Handle message sent by the Pi Network hosting page
	 *
	 * @param event - The received message event
	 * @param awaitedMessage - The expected message
	 * @returns The data of the received message if it match the expected one
	 */
	public handlePiNetworkMessage<M extends RequestMessage<M['type']>>(
		event: MessageEvent<string>,
		awaitedMessage: M,
	): M | undefined {
		let parsedData: M | undefined;

		try {
			parsedData = JSON.parse(event.data);
		} catch {
			if (DEBUG) {
				console.warn('Error while parsing request', event, event.data);
			}

			return;
		}

		if (DEBUG) {
			console.log('Message!', parsedData);
		}

		if (!parsedData) {
			if (DEBUG) {
				console.warn('Unable to parse action');
			}

			return;
		}

		if (parsedData.type === awaitedMessage.type) {
			return parsedData;
		}
	}

	/**
	 * Report an error to the Pi Network Core Team
	 *
	 * @param action - The action that was running when the error occurred
	 * @param message - A message about the error
	 * @param data - Some informations returned by the error
	 */
	public reportError(action: string, message: string, data?: unknown): void {
		this.post(postNetworkError, {
			error: {
				time: getDateTime(),
				call: action,
				message,
				data,
			},
		});
	}

	private createAxios(): void {
		if (!this.backendURL) {
			return;
		}

		this.axiosClient = axios.create({ baseURL: this.backendURL, timeout: 20_000 });
	}

	private isAxiosError(candidate: unknown): candidate is AxiosError {
		return !!candidate && typeof candidate === 'object' && 'isAxiosError' in candidate;
	}
}
