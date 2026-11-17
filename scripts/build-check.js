import { readFile } from "node:fs/promises";

const pkg = JSON.parse(await readFile("package.json", "utf8"));
const entrypoint = pkg.exports?.["."];
if (!entrypoint) {
  throw new Error("package metadata is missing the module entry point");
}

await import(new URL(`../${entrypoint}`, import.meta.url));
console.log(`build check passed: ${entrypoint} loads`);
