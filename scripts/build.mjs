import { build, context } from "esbuild";
const options = {
  entryPoints: ["src/extension.ts"],
  outfile: "dist/extension.js",
  bundle: true,
  external: ["vscode"],
  platform: "node",
  target: "node18",
  format: "cjs",
  sourcemap: false,
};
if (process.argv.includes("--watch")) await (await context(options)).watch();
else await build(options);
