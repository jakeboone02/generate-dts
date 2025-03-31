import { isolatedDeclaration } from "oxc-transform";
import path from "node:path";

interface GenerateDtsParams {
  srcDir?: string;
  outDir?: string;
  outDirEsm?: string;
  ignore?: (filePath: string) => boolean;
}

export const defaultIgnore = (filePath: string): boolean =>
  /(_internal|\.test|(t|T)estUtils)\.tsx?$/.test(filePath) ||
  filePath.startsWith("internal/");

export const generateDTS = async ({
  srcDir = "./src",
  outDir = "./dist/types",
  outDirEsm = "./dist/types-esm",
  ignore = defaultIgnore,
}: GenerateDtsParams = {}): Promise<void> => {
  const g = new Bun.Glob("**/*.{ts,tsx}");

  const files = g.scan(srcDir);

  let fileCount = 0;

  for await (const filePath of files) {
    if (ignore?.(filePath)) {
      continue;
    }

    const originalSource = await Bun.file(path.join(srcDir, filePath)).text();
    const { code } = isolatedDeclaration(filePath, originalSource);

    // Write the CJS DTS file
    await Bun.write(
      path.join(outDir, filePath.replace(/\.tsx?$/, ".d.ts")),
      code
    );

    // Convert DTS file to ESM-in-CJS-context
    const lines = code.split("\n");

    for (const line in lines) {
      const eximLine = lines[line].match(/^(ex|im)port .* from "(\..*)";$/);
      if (eximLine) {
        const resolvedExImPath = path.join(
          srcDir,
          path.parse(filePath).dir,
          eximLine[2]
        );
        if (
          (await Bun.file(`${resolvedExImPath}.ts`).exists()) ||
          (await Bun.file(`${resolvedExImPath}.tsx`).exists())
        ) {
          lines[line] = lines[line].replace(/";$/, `.mjs";`);
        } else if (
          (await Bun.file(`${resolvedExImPath}/index.ts`).exists()) ||
          (await Bun.file(`${resolvedExImPath}/index.tsx`).exists())
        ) {
          lines[line] = lines[line].replace(/";$/, `/index.mjs";`);
        }
      }
    }
    await Bun.write(
      path.join(outDirEsm, filePath.replace(/\.tsx?$/, ".d.mts")),
      lines.join("\n")
    );

    fileCount++;
  }
  console.log(`${fileCount} DTS files generated.`);
};
