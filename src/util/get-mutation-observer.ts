import { MessageHandler } from '../handlers';
import { MessageType } from '../message-types';
import { extractProperties } from './extract-properties';

export function getLocationTracker(): MutationObserver {
	let previousLocation = document.location.href;

	return new MutationObserver(() => {
		if (previousLocation === document.location.href) {
			return;
		}

		previousLocation = document.location.href;

		const location = extractProperties(document.location, [
			'hash',
			'host',
			'hostname',
			'href',
			'origin',
			'pathname',
			'port',
			'protocol',
			'search',
		]);

		MessageHandler.sendSDKMessage({
			type: MessageType.TRACK_LOCATION,
			payload: {
				location,
			},
		});
	});
}
