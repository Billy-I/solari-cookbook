import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import http from "node:http";
import net from "node:net";

const host = "127.0.0.1";
const nextBin = fileURLToPath(
  new URL("../node_modules/next/dist/bin/next", import.meta.url),
);
const expectedBody = JSON.stringify({
  error: {
    code: "METHOD_NOT_ALLOWED",
    message: "Method not allowed.",
  },
});
const routes = [
  {
    allow: "POST, OPTIONS",
    methods: ["GET", "HEAD", "PUT", "PATCH", "DELETE", "PROPFIND", "MKCOL"],
    path: "/api/captures",
  },
  {
    allow: "GET, HEAD, OPTIONS",
    methods: ["POST", "PUT", "PATCH", "DELETE", "PROPFIND", "MKCOL"],
    path: "/api/replays/valid-session-id",
  },
];

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, host, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not reserve a local port."));
        return;
      }
      server.close((error) => {
        if (error) reject(error);
        else resolve(address.port);
      });
    });
  });
}

function request(port, path, method, options = {}) {
  return new Promise((resolve, reject) => {
    const outgoing = http.request(
      { headers: options.headers, host, method, path, port },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.once("end", () => {
          resolve({
            body: Buffer.concat(chunks).toString("utf8"),
            headers: response.headers,
            status: response.statusCode,
          });
        });
      },
    );
    outgoing.once("error", reject);
    outgoing.end(options.body);
  });
}

async function waitForServer(port, child) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Production server exited with ${child.exitCode}.`);
    }
    try {
      await request(port, "/", "GET");
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  throw new Error("Production server did not become ready within 10 seconds.");
}

function validateGuardedResponse(route, method, response) {
  const failures = [];
  if (response.status !== 405) failures.push(`status ${response.status}`);
  if (response.headers.allow !== route.allow) {
    failures.push(`Allow ${response.headers.allow ?? "missing"}`);
  }
  if (response.headers["cache-control"] !== "private, no-store") {
    failures.push(
      `Cache-Control ${response.headers["cache-control"] ?? "missing"}`,
    );
  }
  if (response.headers["access-control-allow-origin"] !== undefined) {
    failures.push("unexpected CORS header");
  }
  if (
    (method === "HEAD" && response.body !== "") ||
    (method !== "HEAD" && response.body !== expectedBody)
  ) {
    failures.push("unexpected safe body");
  }
  return failures.length === 0
    ? null
    : `${method} ${route.path}: ${failures.join(", ")}`;
}

async function stopServer(child) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      if (child.exitCode === null) child.kill("SIGKILL");
      resolve();
    }, 2_000);
    child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function main() {
  const port = await reservePort();
  const environment = {
    ...process.env,
    LIVE_CAPTURE_ENABLED: "false",
  };
  delete environment.SOLARI_API_KEY;
  const child = spawn(
    process.execPath,
    [nextBin, "start", "--hostname", host, "--port", String(port)],
    { env: environment, stdio: "ignore" },
  );

  try {
    await waitForServer(port, child);
    const failures = [];
    const captureRequest = JSON.stringify({
      attempt: 1,
      country: "us",
      runId: "llr_00000000-0000-4000-8000-000000000000",
      url: "https://example.com/",
    });
    const capture = await request(port, "/api/captures", "POST", {
      body: captureRequest,
      headers: {
        "Content-Length": Buffer.byteLength(captureRequest),
        "Content-Type": "application/json",
      },
    });
    const replay = await request(
      port,
      "/api/replays/valid-session-id",
      "GET",
    );
    const replayHead = await request(
      port,
      "/api/replays/valid-session-id",
      "HEAD",
    );
    const captureOptions = await request(port, "/api/captures", "OPTIONS");
    const replayOptions = await request(
      port,
      "/api/replays/valid-session-id",
      "OPTIONS",
    );
    const page = await request(port, "/", "GET");
    const rootPropfind = await request(port, "/", "PROPFIND");

    if (
      capture.status !== 403 ||
      capture.headers["cache-control"] !== "no-store" ||
      capture.body !==
        JSON.stringify({
          ok: false,
          correlation: null,
          error: {
            code: "CAPTURE_FAILED",
            message: "The regional capture could not be completed.",
            retryable: true,
          },
        })
    ) {
      failures.push("Allowed capture POST did not reach the live-disabled route.");
    } else {
      console.log("POST /api/captures: PASS (live-disabled route preserved)");
    }
    if (
      replay.status !== 403 ||
      replay.headers["cache-control"] !== "no-store" ||
      replay.body !== JSON.stringify({ status: "unavailable" })
    ) {
      failures.push("Allowed replay GET did not reach the live-disabled route.");
    } else {
      console.log(
        "GET /api/replays/valid-session-id: PASS (live-disabled route preserved)",
      );
    }
    if (
      replayHead.status !== replay.status ||
      replayHead.headers["cache-control"] !== replay.headers["cache-control"] ||
      replayHead.headers["content-type"] !== replay.headers["content-type"] ||
      replayHead.headers.allow !== replay.headers.allow ||
      replayHead.headers["access-control-allow-origin"] !== undefined ||
      replayHead.body !== ""
    ) {
      failures.push("Allowed replay HEAD did not preserve GET failure semantics.");
    } else {
      console.log(
        "HEAD /api/replays/valid-session-id: PASS (bodyless GET semantics)",
      );
    }
    for (const [route, response] of [
      [routes[0], captureOptions],
      [routes[1], replayOptions],
    ]) {
      if (
        response.status !== 204 ||
        response.body !== "" ||
        response.headers.allow !== route.allow ||
        response.headers["cache-control"] !== "no-store" ||
        response.headers["access-control-allow-origin"] !== undefined
      ) {
        failures.push(`OPTIONS ${route.path} did not preserve route semantics.`);
      } else {
        console.log(`OPTIONS ${route.path}: PASS`);
      }
    }
    if (page.status !== 200) {
      failures.push("The narrow Proxy matcher changed the main page response.");
    } else {
      console.log("GET /: PASS (outside narrow Proxy matcher)");
    }
    if (
      rootPropfind.status !== 405 ||
      rootPropfind.headers.allow !== "GET, HEAD" ||
      rootPropfind.headers["cache-control"] !== undefined ||
      rootPropfind.body === expectedBody
    ) {
      failures.push("PROPFIND / was transformed by the API method guard.");
    } else {
      console.log("PROPFIND /: PASS (outside API method guard)");
    }

    for (const route of routes) {
      for (const method of route.methods) {
        const response = await request(port, route.path, method);
        const failure = validateGuardedResponse(route, method, response);
        if (failure) failures.push(failure);
        else console.log(`${method} ${route.path}: PASS`);
      }

      const trace = await request(port, route.path, "TRACE");
      const traceFailure = validateGuardedResponse(route, "TRACE", trace);
      if (!traceFailure) {
        console.log(`TRACE ${route.path}: PASS`);
      } else if (
        trace.status === 500 &&
        trace.headers.allow === undefined
      ) {
        console.log(`TRACE ${route.path}: NOT_PROVEN (rejected before Proxy)`);
      } else {
        failures.push(traceFailure);
      }
    }

    if (failures.length > 0) {
      throw new Error(`API method guard failed:\n${failures.join("\n")}`);
    }
  } finally {
    await stopServer(child);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "API method guard failed.");
  process.exitCode = 1;
});
