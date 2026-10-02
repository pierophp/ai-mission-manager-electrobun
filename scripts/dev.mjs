import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import net from "node:net";

const environment = { ...process.env, ELECTROBUN_RENDERER_URL: "http://127.0.0.1:5173" };
const children = [];
let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  process.exitCode = code;
}

function start(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: environment,
    stdio: "inherit",
    ...options,
  });
  children.push(child);
  child.once("error", (error) => {
    console.error(`${command} could not start: ${error.message}`);
    stop(1);
  });
  child.once("exit", (code, signal) => {
    if (!stopping) stop(code ?? (signal ? 1 : 0));
  });
  return child;
}

async function waitForVite() {
  for (let attempt = 0; attempt < 120 && !stopping; attempt += 1) {
    const connected = await new Promise((resolve) => {
      const socket = net.connect(5173, "127.0.0.1");
      socket.once("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.once("error", () => resolve(false));
    });
    if (connected) return;
    await delay(250);
  }
  throw new Error("Vite did not start on 127.0.0.1:5173");
}

process.once("SIGINT", () => stop(0));
process.once("SIGTERM", () => stop(0));

start("bunx", ["vp", "dev", "--host", "127.0.0.1"]);
try {
  await waitForVite();
  if (!stopping) start("bunx", ["electrobun", "dev"]);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  stop(1);
}
