import { register } from "node:module";


register("./custom-loader.mjs", import.meta.url);
