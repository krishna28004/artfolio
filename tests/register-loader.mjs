import { register } from "node:module";


register("./custom-loader.mjs", import.meta.url);

// Route tests use mocked providers and explicitly opt into fixture writes.
process.env.ARTFOLIO_COMMISSIONS_ENABLED = "true";
process.env.ARTFOLIO_PAYMENTS_ENABLED = "true";
