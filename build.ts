import { isolatedDeclaration } from "oxc-transform";

// Build JS
await Bun.build({
  entrypoints: ["./index.ts"],
  outdir: "./dist",
  external: ["oxc-transform"],
  target: "bun",
});

// Build DTS
const src = await Bun.file("./index.ts").text();
const { code } = isolatedDeclaration("./index.ts", src);
await Bun.write("./dist/index.d.ts", code);
