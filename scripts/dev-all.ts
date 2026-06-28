import { spawn, ChildProcess } from "child_process";

/**
 * Runs the local storage server and the Next.js dev server together in one
 * terminal — `npm run dev:storage` and `npm run dev` still work standalone
 * for anyone who wants them in separate windows.
 */
const children: ChildProcess[] = [];

function run(label: string, command: string, args: string[]) {
  const child = spawn([command, ...args].join(" "), { stdio: "pipe", shell: true });
  children.push(child);

  const prefix = `[${label}] `;
  child.stdout?.on("data", (chunk: Buffer) => process.stdout.write(prefixLines(chunk, prefix)));
  child.stderr?.on("data", (chunk: Buffer) => process.stderr.write(prefixLines(chunk, prefix)));
  child.on("exit", (code) => {
    console.log(`${prefix}exited with code ${code}`);
    shutdown();
  });
}

function prefixLines(chunk: Buffer, prefix: string): string {
  return chunk
    .toString()
    .split("\n")
    .map((line) => (line.length ? prefix + line : line))
    .join("\n");
}

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) child.kill();
  process.exit();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

run("storage", "npx", ["tsx", "-r", "dotenv/config", "scripts/dev-storage.ts"]);
run("app", "npx", ["next", "dev"]);
