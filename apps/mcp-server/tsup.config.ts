import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/stdio.ts"],
  format: ["cjs"],
  platform: "node",
  target: "node22",
  clean: true,
  outExtension() {
    return { js: ".cjs" };
  },
});
