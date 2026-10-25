import type { APIRoute } from 'astro';
import { ADSENSE_CLIENT_ID } from '../data/data';

// AdSense checks https://<site>/ads.txt for this record. The publisher ID in it is
// the client ID without its "ca-" prefix; f08c47fec0942fa0 is Google's fixed TAG ID.
const getAdsTxt = (clientId: string) => clientId
    ? `google.com, ${clientId.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n`
    : `# Set ADSENSE_CLIENT_ID in src/data/data.ts to publish the AdSense record.\n`;

export const GET: APIRoute = () => new Response(getAdsTxt(ADSENSE_CLIENT_ID), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
});
