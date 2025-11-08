import path from "node:path";
import { fileURLToPath } from "node:url";
import { generate, PostgresDialect } from "kysely-codegen";
import { db } from "./kysely.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outFile = path.resolve(__dirname, "generated-types.ts");

async function main() {
  console.log(`🛠️  Generating Kysely types -> ${outFile}`);
  await generate({
    db,
    dialect: new PostgresDialect(),
    outFile,
    camelCase: false
  });
  console.log("✅ Kysely types generated");
  await db.destroy();
}

main().catch((err) => {
  console.error("❌ Failed to generate Kysely types");
  console.error(err);
  process.exit(1);
});
