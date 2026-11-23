import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';
import { appUrl } from '../api/paths';

const worker = setupWorker(...handlers);

export async function startWorker() {
  await worker.start({
    serviceWorker: { url: appUrl('mockServiceWorker.js') },
    onUnhandledRequest: 'bypass',
    quiet: true,
  });
}
