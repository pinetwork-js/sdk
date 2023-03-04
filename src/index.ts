import { PiClient } from './pi-client';

export const Pi = new PiClient();

declare global {
	interface Window {
		Pi: PiClient;
	}
}

window.Pi = Pi;

export * from './handlers';
export * from './pi-client';
