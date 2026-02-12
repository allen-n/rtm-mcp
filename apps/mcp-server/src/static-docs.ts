import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const defaultDocsDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../docs"
);

export function createStaticDocReader(docsDir: string = defaultDocsDir) {
  const cache = new Map<string, string>();

  return async (filename: string): Promise<string> => {
    // Prevent path traversal; docs are served by filename only.
    if (path.basename(filename) !== filename) {
      throw new Error(`Invalid static doc name: ${filename}`);
    }

    const cached = cache.get(filename);
    if (cached !== undefined) {
      return cached;
    }

    const fullPath = path.join(docsDir, filename);
    const content = await readFile(fullPath, "utf8");
    cache.set(filename, content);
    return content;
  };
}

export const getStaticDoc = createStaticDocReader();
