// Child processes and bounded concurrency for the repository's check scripts.
import { spawn } from "node:child_process";

/**
 * Runs a command, rejecting unless it exits with 0. With `capture`, resolves
 * to its stdout and prints its output only when it fails.
 */
export function run(command, args, { cwd = process.cwd(), capture = false, timeoutMs } = {}) {
  const label = `${command} ${args.join(" ")}`;
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit" });
    let stdout = "";
    let stderr = "";
    if (capture) {
      child.stdout.setEncoding("utf8").on("data", (chunk) => (stdout += chunk));
      child.stderr.setEncoding("utf8").on("data", (chunk) => (stderr += chunk));
    }
    let timedOut = false;
    let forceKill;
    const timeout = timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          child.kill("SIGTERM");
          forceKill = setTimeout(() => child.kill("SIGKILL"), 5000);
        }, timeoutMs)
      : undefined;
    const settle = () => {
      clearTimeout(timeout);
      clearTimeout(forceKill);
    };
    child.on("error", (error) => {
      settle();
      reject(new Error(`${label} failed in ${cwd}: ${error.message}`));
    });
    child.on("exit", (code, signal) => {
      settle();
      if (code === 0) return resolve(stdout);
      if (capture) process.stderr.write(stderr || stdout);
      reject(new Error(`${label} ${timedOut ? "timed out" : `exited with ${signal ?? code}`} in ${cwd}`));
    });
  });
}

/** Runs `task` over `items`, at most `concurrency` at a time, stopping at the first failure. */
export async function forEachConcurrently(items, concurrency, task) {
  let next = 0;
  let firstError;
  const worker = async () => {
    while (!firstError && next < items.length) {
      const index = next++;
      try {
        await task(items[index], index);
      } catch (error) {
        firstError ??= error;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  if (firstError) throw firstError;
}
