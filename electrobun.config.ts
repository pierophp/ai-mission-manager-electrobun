import type { ElectrobunConfig } from "electrobun";

export default {
  app: {
    name: "AI Mission Manager",
    identifier: "dev.pierophp.ai-mission-manager",
    version: "1.0.0",
  },
  build: {
    mainProcess: "bun",
    bun: { entrypoint: "src/bun/index.ts" },
    copy: {
      dist: "views/main",
      "agents/pstack": "pstack",
      "src/main/pstack-manifest.json": "pstack-manifest.json",
      "src/main/resources": "resources",
    },
  },
  runtime: { exitOnLastWindowClosed: true },
} satisfies ElectrobunConfig;
