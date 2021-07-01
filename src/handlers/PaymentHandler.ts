import {
	APIPartialPayment,
	APIPayment,
	APIPaymentTransaction,
	RESTGetRecentPaymentResult,
	routes,
} from '@pinetwork-js/api-typing';
import { MessageType } from '../MessageTypes';
import { MessageHandler, SDKMessage } from './MessageHandler';
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

	/**
	 * Run the payment flow
	 */
	public async runPaymentFlow(): Promise<void> {
		let paymentMessage: SDKMessage<MessageType.PREPARE_PAYMENT_FLOW>;

		try {
			paymentMessage = await MessageHandler.sendSDKMessage({ type: MessageType.PREPARE_PAYMENT_FLOW });
		} catch (error) {
			this.callbacks.onError(error);

			return;
		}

		if (paymentMessage.payload.pending) {
			const { pendingPayment } = paymentMessage.payload;

			this.callbacks.onError(new Error('A pending payment needs to be handled.'), pendingPayment);
			this.onIncompletePaymentFound(pendingPayment);

			return;
		}

		let payment: APIPayment | undefined;

		try {
			payment = await RequestHandler.getInstance().post(routes.createPayment, this.paymentData);
		} catch (error) {
			MessageHandler.sendSDKMessage({
				type: MessageType.SHOW_PRE_PAYMENT_ERROR,
				payload: { paymentError: error.response.data.error },
			});

			this.callbacks.onError(error);

			return;
		}

		if (!payment) {
			return;
		}

		const paymentId = payment.identifier;

		MessageHandler.sendSDKMessage({ type: MessageType.START_PAYMENT_FLOW, payload: { paymentId } });
		this.callbacks.onReadyForServerApproval(paymentId);

		let approvedPaymentMessage: SDKMessage<MessageType.WAIT_FOR_TRANSACTION>;

		try {
			approvedPaymentMessage = await MessageHandler.sendSDKMessage({ type: MessageType.WAIT_FOR_TRANSACTION });
		} catch (error) {
			this.callbacks.onError(error);

			return;
		}

		if (approvedPaymentMessage.payload.cancelled) {
			this.callbacks.onCancel(approvedPaymentMessage.payload.paymentId);

			return;
		}

		this.callbacks.onReadyForServerCompletion(
			approvedPaymentMessage.payload.paymentId,
			approvedPaymentMessage.payload.txid,
		);
	}

	/**
	 * Check if there is a pending payment
	 *
	 * @param onIncompletePaymentFound - Callback function triggered if an incomplete payment is found
	 */
	public static async checkForPendingPayment(onIncompletePaymentFound: (payment: APIPayment) => void): Promise<void> {
		let recentPayment: RESTGetRecentPaymentResult | undefined;

		try {
			recentPayment = await RequestHandler.getInstance().get(routes.getRecentPayment);
		} catch {
			return;
		}

		if (!recentPayment || !recentPayment.exists || recentPayment.payment?.status.cancelled) {
			return;
		}

		onIncompletePaymentFound(recentPayment.payment!);
	}
}
