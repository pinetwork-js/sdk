import { APIPartialPayment, APIPayment, APIPaymentTransaction, routes } from '@pinetwork-js/api-typing';
import { MessageType } from '../MessageTypes';
import { sleep } from '../util';
import { MessageHandler, PaymentStatus } from './MessageHandler';
import { RequestHandler } from './RequestHandler';

export interface PaymentCallbacks {
	/**
	 * Callback function triggered when a payment is ready to be approved by the server
	 */
	onReadyForServerApproval: (paymentId: APIPayment['identifier']) => void;

	/**
	 * Callback function triggered when a payment is ready to be completed by the server
	 */
	onReadyForServerCompletion: (paymentId: APIPayment['identifier'], txid: APIPaymentTransaction['txid']) => void;

	/**
	 * Callback function triggered when a payment is cancelled
	 */
	onCancel: (paymentId: APIPayment['identifier']) => void;

	/**
	 * Callback function triggered when an error occurs
	 */
	onError: (error: Error, payment?: APIPayment) => void;
}

/**
 * Handler for payments
 */
export class PaymentHandler {
	/**
	 * Number of retries allowed
	 */
	public retryCounter = 5;

	public constructor(
		/**
		 * Information about the payment
		 */
		public readonly paymentData: APIPartialPayment,

		/**
		 * Callback functions for the payment process
		 */
		public readonly callbacks: PaymentCallbacks,

		/**
		 * Callback function triggered if an incomplete payment is found
		 */
		public readonly onIncompletePaymentFound: (payment: APIPayment) => void,
	) {
		this.runPaymentFlow();
	}

	public async retryableCallback(retryCallback: () => void, paymentStatus: PaymentStatus): Promise<void> {
		retryCallback();

		await sleep(10_000);

		const decideCallbackRetrial = await MessageHandler.sendSDKMessage({
			type: MessageType.DECIDE_CALLBACK_RETRIAL,
			payload: { targetStatus: paymentStatus },
		});

		if (decideCallbackRetrial && decideCallbackRetrial.payload.retry && this.retryCounter > 0) {
			this.retryCounter--;

			return this.retryableCallback(retryCallback, paymentStatus);
		}

		this.retryCounter = 5;
	}

	/**
	 * Run the payment flow
	 */
	public async runPaymentFlow(): Promise<void> {
		const paymentMessage = await MessageHandler.sendSDKMessage({ type: MessageType.PREPARE_PAYMENT_FLOW }).catch(
			(error) => this.callbacks.onError(error),
		);

		if (!paymentMessage) {
			return;
		}

		if (paymentMessage.payload.pending) {
			const { pendingPayment } = paymentMessage.payload;

			this.callbacks.onError(new Error('A pending payment needs to be handled.'), pendingPayment);
			this.onIncompletePaymentFound(pendingPayment);

			return;
		}

		const payment = await RequestHandler.getInstance()
			.post(routes.createPayment, this.paymentData)
			.catch((error) => {
				MessageHandler.sendSDKMessage({
					type: MessageType.SHOW_PRE_PAYMENT_ERROR,
					payload: { paymentError: error.response.data.error },
				});

				this.callbacks.onError(error);
			});

		if (!payment) {
			return;
		}

		const paymentId = payment.identifier;

		MessageHandler.sendSDKMessage({ type: MessageType.START_PAYMENT_FLOW, payload: { paymentId } });

		this.retryableCallback(() => {
			this.callbacks.onReadyForServerApproval(paymentId);
		}, 'developerApproved');

		const approvedPaymentMessage = await MessageHandler.sendSDKMessage({
			type: MessageType.WAIT_FOR_TRANSACTION,
		}).catch((error) => this.callbacks.onError(error));

		if (!approvedPaymentMessage) {
			return;
		}

		if (approvedPaymentMessage.payload.cancelled) {
			this.callbacks.onCancel(approvedPaymentMessage.payload.paymentId);

			return;
		}

		this.retryableCallback(() => {
			this.callbacks.onReadyForServerCompletion(
				approvedPaymentMessage.payload.paymentId,
				approvedPaymentMessage.payload.txid,
			);
		}, 'developerCompleted');
	}

	/**
	 * Check if there is a pending payment
	 *
	 * @param onIncompletePaymentFound - Callback function triggered if an incomplete payment is found
	 */
	public static async checkForPendingPayment(onIncompletePaymentFound: (payment: APIPayment) => void): Promise<void> {
		const incompletePayment = await RequestHandler.getInstance().get(routes.getIncompletePayment).catch();

		if (!incompletePayment || !incompletePayment.exists || incompletePayment.payment?.status.cancelled) {
			return;
		}

		onIncompletePaymentFound(incompletePayment.payment!);
	}
}
