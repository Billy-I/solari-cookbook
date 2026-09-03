import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);
const SOURCE_ROOTS = ["app", "src/components", "src/features", "src/lib"];
const ASSET_ROOTS = ["public", ".next/static", ".next/server/app"];
const SOURCE_MARKERS = [
  ["runtime mode switch", /NEXT_PUBLIC_APP_MODE/],
  ["server key fallback", /process\.env\.SOLARI_API_KEY/],
  ["test fixture import", /(?:@\/)?src\/test(?:\/|["'])/],
  ["sample runtime", /use-sample-run/],
];
const PERSISTENCE_MARKER =
  /\b(?:localStorage|sessionStorage|indexedDB|CacheStorage|caches|analytics|telemetry)\b|(?:from|require\s*\()\s*["']node:fs/;
const SERVER_CREDENTIAL_MARKER =
  /credential-session-store|session-cookie|(?:src\/lib\/solari|src\\lib\\solari)/;
const BUILD_CANARY = "synthetic-secret-build-canary";

function extension(path) {
  const match = path.match(/(\.[^.\/]+)$/);
  return match?.[1] ?? "";
}

function isTestOnly(path) {
  return /(?:^|\/)e2e(?:\/|$)|\.(?:test|spec)\.[^/]+$/.test(path);
}

function splitEntry(entry) {
  if (typeof entry === "string") {
    const separator = entry.indexOf(" -> ");
    return separator === -1
      ? { path: entry, content: "" }
      : {
          path: entry.slice(0, separator),
          content: entry.slice(separator + 4),
        };
  }
  return entry;
}

export function findProductionBoundaryViolations(entries) {
  const violations = [];

  for (const rawEntry of entries) {
    const { path, content } = splitEntry(rawEntry);
    const normalizedPath = path.replaceAll("\\", "/");
    if (isTestOnly(normalizedPath)) continue;

    const isSource = SOURCE_ROOTS.some(
      (root) => normalizedPath === root || normalizedPath.startsWith(`${root}/`),
    );
    const isBuild =
      normalizedPath.startsWith(".next/static/") ||
      normalizedPath.startsWith(".next/server/app/");

    if (normalizedPath.startsWith("public/sample/")) {
      violations.push(`${normalizedPath}: public sample asset`);
    }

    if (isSource) {
      for (const [label, pattern] of SOURCE_MARKERS) {
        if (pattern.test(content) || (label === "sample runtime" && pattern.test(normalizedPath))) {
          violations.push(`${normalizedPath}: ${label}`);
        }
      }
    }

    if (
      normalizedPath.startsWith("src/features/credential/") &&
      PERSISTENCE_MARKER.test(content)
    ) {
      violations.push(`${normalizedPath}: credential persistence or telemetry sink`);
    }

    if (isBuild && content.includes(BUILD_CANARY)) {
      violations.push(`${normalizedPath}: synthetic build canary`);
    }

    if (
      normalizedPath.startsWith(".next/server/app/") &&
      normalizedPath.includes("client-reference-manifest") &&
      SERVER_CREDENTIAL_MARKER.test(content)
    ) {
      violations.push(`${normalizedPath}: server credential module in client manifest`);
    }
  }

  return violations;
}

export function assertBoundaryHelperContract() {
  const rejected = [
    "app/page.tsx -> @/src/test/fixtures",
    "src/features/run/use-sample-run.ts",
    "public/sample/us.jpg",
    ".next/static/chunks/app.js -> synthetic-secret-build-canary",
  ];
  assert.equal(findProductionBoundaryViolations(rejected).length, rejected.length);
  assert.deepEqual(
    findProductionBoundaryViolations([
      "docs/current.md -> sample mode is historical",
    ]),
    [],
  );
}

async function walk(directory) {
  const rows = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) rows.push(...(await walk(path)));
    else if (entry.isFile()) rows.push(path);
  }
  return rows;
}

async function requireDirectory(path) {
  try {
    if (!(await stat(path)).isDirectory()) throw new Error("not a directory");
  } catch (error) {
    throw new Error(`Required production boundary directory is unavailable (${path}): ${error.message}`);
  }
}

export async function collectProductionEntries(root = process.cwd()) {
  const entries = [];
  for (const rootPath of [...SOURCE_ROOTS, ...ASSET_ROOTS]) {
    const absoluteRoot = resolve(root, rootPath);
    await requireDirectory(absoluteRoot);
    for (const absolutePath of await walk(absoluteRoot)) {
      const path = relative(root, absolutePath).replaceAll("\\", "/");
      const sourcePath = SOURCE_ROOTS.includes(rootPath);
      if (sourcePath && (!SOURCE_EXTENSIONS.has(extension(path)) || isTestOnly(path))) {
        continue;
      }
      entries.push({ path, content: (await readFile(absolutePath)).toString("utf8") });
    }
  }
  return entries;
}

async function main() {
  assertBoundaryHelperContract();
  const entries = await collectProductionEntries();
  const violations = findProductionBoundaryViolations(entries);
  if (violations.length > 0) {
    throw new Error(`Production boundary violations:\n${violations.map((row) => `- ${row}`).join("\n")}`);
  }
  console.log(`Production boundary check passed (${entries.length} files scanned).`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(`Production boundary check failed: ${error.message}`);
    process.exitCode = 1;
  });
}
