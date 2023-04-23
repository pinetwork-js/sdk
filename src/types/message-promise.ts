import type { MessageType } from '../message-types';
import type { ResponseMessage } from './response-message';

export interface MessagePromise {
	resolve: <T extends MessageType>(message: ResponseMessage<T>) => void;
	reject: (reason?: unknown) => void;
}
