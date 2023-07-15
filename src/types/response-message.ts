import type { APIPayment } from '@pinetwork-js/api-typing';
import type { MessageType } from '../message-types';

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

type NativeFeature = 'inline_media' | 'request_permission';

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

interface CopyTextFromTPAResponsePayload {
	/**
	 * Whether or not the text was successfully copied
	 */
	success: boolean;
}

interface RequestNativePermissionResponsePayload {
	/**
	 * Whether or not the requested permission has been granted
	 */
	granted: boolean | null;
}

/* eslint-disable @typescript-eslint/sort-type-constituents */
type OpenUrlInSystemBrowserResponsePayload =
	| {
			/**
			 * Whether or not the url was successfully opened
			 */
			success: true;
	  }
	| {
			/**
			 * Whether or not the url was successfully opened
			 */
			success: false;

			/**
			 * The error message
			 */
			message: string;
	  };

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
	: T extends MessageType.COPY_TEXT_FROM_TPA
	? CopyTextFromTPAResponsePayload
	: T extends MessageType.REQUEST_NATIVE_PERMISSION
	? RequestNativePermissionResponsePayload
	: T extends MessageType.OPEN_URL_IN_SYSTEM_BROWSER
	? OpenUrlInSystemBrowserResponsePayload
	: void;

export interface BaseResponseMessage {
	/**
	 * The id of the message
	 */
	id?: number;
}

export type ResponseMessage<T extends MessageType> = ResponseMessagePayload<T> extends void
	? BaseResponseMessage
	: Required<BaseResponseMessage> & {
			/**
			 * The payload of the message
			 */
			payload: ResponseMessagePayload<T>;
	  };
