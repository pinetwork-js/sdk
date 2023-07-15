import type { APIUserScopes } from '@pinetwork-js/api-typing';
import type { MessageType } from '../message-types';

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

export type PaymentError =
	| 'horizon_failure'
	| 'invalid_input'
	| 'missing_wallet'
	| 'not_approved_payment'
	| 'pending_check_failed'
	| 'pending_payment'
	| 'stale_payment';

interface ShowPrePaymentErrorRequestPayload {
	/**
	 * The payment error
	 */
	paymentError: PaymentError;
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
	scopes: APIUserScopes[];
}

export type PaymentStatus = 'developerApproved' | 'developerCompleted';

interface DecidalCallbackRetrialRequestPayload {
	/**
	 * The status of the payment concerned by the retry request
	 */
	targetStatus: PaymentStatus;
}

interface CopyTextFromTPAPayload {
	/**
	 * The text to copy
	 */
	text: string;
}

export type Permission = 'camera';

interface RequestNativePermissionPayload {
	/**
	 * The native permission to request
	 */
	permission: Permission;
}

interface OpenUrlInSystemBrowserPayload {
	/**
	 * The url to open
	 */
	url: string;
}

interface TrackLocationPayload {
	/**
	 * The location object
	 */
	location: object;
}

type RequestMessagePayload<T extends MessageType> = T extends MessageType.OPEN_APP_CONVERSATION_WITH_ID
	? OpenAppConversationRequestPayload
	: T extends MessageType.OPEN_SHARE_DIALOG_ACTION
	? OpenShareDialogRequestPayload
	: T extends MessageType.SHOW_PRE_PAYMENT_ERROR
	? ShowPrePaymentErrorRequestPayload
	: T extends MessageType.START_PAYMENT_FLOW
	? StartPaymentFlowRequestPayload
	: T extends MessageType.OPEN_CONSENT_MODAL
	? OpenConsentModalRequestPayload
	: T extends MessageType.DECIDE_CALLBACK_RETRIAL
	? DecidalCallbackRetrialRequestPayload
	: T extends MessageType.COPY_TEXT_FROM_TPA
	? CopyTextFromTPAPayload
	: T extends MessageType.REQUEST_NATIVE_PERMISSION
	? RequestNativePermissionPayload
	: T extends MessageType.OPEN_URL_IN_SYSTEM_BROWSER
	? OpenUrlInSystemBrowserPayload
	: T extends MessageType.TRACK_LOCATION
	? TrackLocationPayload
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
