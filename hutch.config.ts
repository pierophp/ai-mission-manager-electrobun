export default {
  electrobun: { version: "2.0.2" },
  packageManager: "bun",
  scripts: {
    install: ["bun", "install", "--frozen-lockfile"],
    dev: ["bun", "run", "dev"],
    build: ["bun", "run", "build"],
    start: ["bun", "run", "start"],
  },
};
