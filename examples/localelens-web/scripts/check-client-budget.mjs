import { readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const BUDGET_BYTES = 180 * 1024;
const BUILD_DIRECTORY = resolve(process.cwd(), ".next");
const MAIN_ROUTE = "/";
const FORBIDDEN_CLIENT_MARKERS = [
  "SOLARI_API_KEY",
  "credential-session-store",
  "createSolariClient",
  "synthetic-secret-build-canary",
];

function fail(message) {
  throw new Error(message);
}

async function readJson(relativePath, label) {
  const absolutePath = resolve(BUILD_DIRECTORY, relativePath);

  try {
    return JSON.parse(await readFile(absolutePath, "utf8"));
  } catch (error) {
    fail(`Cannot read ${label} (${relativePath}): ${error.message}`);
  }
}

async function readClientReferenceManifest(relativePath, appPath) {
  const absolutePath = resolve(BUILD_DIRECTORY, relativePath);
  let source;

  try {
    source = await readFile(absolutePath, "utf8");
  } catch (error) {
    fail(
      `Cannot read main-route client reference manifest (${relativePath}): ${error.message}`,
    );
  }

  const match = source.match(
    /globalThis\.__RSC_MANIFEST\[("(?:\\.|[^"\\])*")\]\s*=\s*(\{[\s\S]*\});?\s*$/,
  );

  if (!match) {
    fail(`Cannot parse main-route client reference manifest (${relativePath}).`);
  }

  try {
    if (JSON.parse(match[1]) !== appPath) {
      fail(
        `Main-route client reference manifest (${relativePath}) is assigned to a different route.`,
      );
    }

    return JSON.parse(match[2]);
  } catch (error) {
    fail(
      `Cannot parse main-route client reference manifest (${relativePath}): ${error.message}`,
    );
  }
}

function requireStringArray(value, label) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    fail(`${label} is missing or invalid.`);
  }

  return value;
}

function chunkPath(chunk) {
  const relativePath = chunk.startsWith("/_next/")
    ? chunk.slice("/_next/".length)
    : chunk;

  if (!relativePath.startsWith("static/") || !relativePath.endsWith(".js")) {
    fail(`Main-route manifest references an invalid client JavaScript chunk: ${chunk}`);
  }

  return relativePath;
}

function collectClientModuleChunks(clientModules) {
  if (!clientModules || typeof clientModules !== "object") {
    fail("Main-route client reference manifest is missing clientModules.");
  }

  return Object.values(clientModules).flatMap((module) => {
    if (!module || typeof module !== "object") {
      fail("Main-route client reference manifest contains an invalid client module.");
    }

    return requireStringArray(module.chunks, "A client module chunk list");
  });
}

function collectEntryChunks(entryJSFiles) {
  if (!entryJSFiles || typeof entryJSFiles !== "object") {
    fail("Main-route client reference manifest is missing entryJSFiles.");
  }

  return Object.values(entryJSFiles).flatMap((chunks) =>
    requireStringArray(chunks, "An entry JavaScript file list"),
  );
}

async function main() {
  const appPathRoutes = await readJson(
    "app-path-routes-manifest.json",
    "app-path routes manifest",
  );
  const appPath = Object.entries(appPathRoutes).find(
    ([, route]) => route === MAIN_ROUTE,
  )?.[0];

  if (typeof appPath !== "string" || !appPath.startsWith("/")) {
    fail(`Main App Router route ${MAIN_ROUTE} is missing from app-path-routes-manifest.json.`);
  }

  const buildManifest = await readJson("build-manifest.json", "build manifest");
  const routeManifestPath = `server/app${appPath}_client-reference-manifest.js`;
  const routeManifest = await readClientReferenceManifest(routeManifestPath, appPath);
  const rootMainFiles = requireStringArray(
    buildManifest.rootMainFiles,
    "build manifest rootMainFiles",
  );
  const routeChunks = [
    ...collectEntryChunks(routeManifest.entryJSFiles),
    ...collectClientModuleChunks(routeManifest.clientModules),
  ];
  if (rootMainFiles.length === 0) {
    fail("Build manifest rootMainFiles is empty.");
  }
  if (routeChunks.length === 0) {
    fail("Main-route client reference manifest contains no client JavaScript chunks.");
  }
  const chunks = new Set(
    [
      ...rootMainFiles,
      ...routeChunks,
    ].map(chunkPath),
  );

  if (chunks.size === 0) {
    fail("Main-route client JavaScript chunk set is empty.");
  }

  const rows = [];
  for (const chunk of [...chunks].sort()) {
    const absolutePath = resolve(BUILD_DIRECTORY, chunk);
    if (relative(BUILD_DIRECTORY, absolutePath).startsWith("..")) {
      fail(`Main-route manifest references a chunk outside .next: ${chunk}`);
    }

    try {
      const source = await readFile(absolutePath);
      const text = source.toString("utf8");
      for (const marker of FORBIDDEN_CLIENT_MARKERS) {
        if (text.includes(marker)) {
          fail(`Main-route client chunk contains forbidden marker ${marker}: ${chunk}`);
        }
      }
      rows.push({
        chunk,
        bytes: gzipSync(source).length,
      });
    } catch (error) {
      fail(`Cannot read main-route client chunk (${chunk}): ${error.message}`);
    }
  }

  const total = rows.reduce((sum, row) => sum + row.bytes, 0);
  console.log(`Main route: ${MAIN_ROUTE} (${appPath})`);
  console.log("Manifest provenance:");
  console.log("- .next/app-path-routes-manifest.json");
  console.log("- .next/build-manifest.json");
  console.log(`- .next/${routeManifestPath}`);
  console.log("Gzipped client JavaScript:");
  for (const row of rows) {
    console.log(`${row.bytes.toString().padStart(6)} B  ${row.chunk}`);
  }
  console.log(`Total: ${total} B`);
  console.log(`Ceiling: ${BUDGET_BYTES} B (180 KiB)`);

  if (total > BUDGET_BYTES) {
    fail(`Main-route client JavaScript exceeds the gzip budget by ${total - BUDGET_BYTES} B.`);
  }
}

main().catch((error) => {
  console.error(`Client budget check failed: ${error.message}`);
  process.exitCode = 1;
});
