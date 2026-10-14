import { register } from "node:module";


register("./custom-loader.mjs", import.meta.url);

// Only mocked route tests opt into intake/checkout. Application defaults stay closed.
process.env.ARTFOLIO_COMMISSIONS_ENABLED = "true";
process.env.ARTFOLIO_PAYMENTS_ENABLED = "true";

// No provider credentials may escape into test workers.
delete process.env.RESEND_API_KEY;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;