import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: "data:text/javascript,export {};", shortCircuit: true };
  if (specifier === "next/cache") return { url: "data:text/javascript,export function revalidatePath() {};", shortCircuit: true };
  if (specifier === "next/server") {
    return nextResolve("next/server.js", context);
  }
  if (specifier === "next/headers") {
    return nextResolve("next/headers.js", context);
  }
  if (specifier.startsWith("@/")) {
    const rawPath = path.resolve(process.cwd(), "src", specifier.slice(2));
    const candidates = [
      rawPath,
      `${rawPath}.ts`,
      `${rawPath}.tsx`,
      path.join(rawPath, "index.ts"),
      path.join(rawPath, "index.tsx"),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return {
          url: pathToFileURL(candidate).href,
          shortCircuit: true,
        };
      }
    }
  }
  return nextResolve(specifier, context);
}
