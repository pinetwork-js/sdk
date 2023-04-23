import type { APIPayment, APIPaymentTransaction } from '@pinetwork-js/api-typing';

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
