import {
  LOCAL_REQUEST_HEADER,
  LOCAL_REQUEST_HEADER_VALUE,
} from "./protocol";

export type AppRequestOptions = {
  requireJson?: boolean;
  requireOrigin: boolean;
};

function applicationOrigin(request: Request): string {
  const requestUrl = new URL(request.url);
  const forwardedProtocol = request.headers.get("x-forwarded-proto");
  const protocol =
    forwardedProtocol === "http" || forwardedProtocol === "https"
      ? `${forwardedProtocol}:`
      : requestUrl.protocol;
  const host = request.headers.get("host") ?? requestUrl.host;
  if (host.includes(",")) throw new Error("INVALID_HOST");

  const reconstructed = new URL(`${protocol}//${host}`);
  if (
    reconstructed.username ||
    reconstructed.password ||
    reconstructed.pathname !== "/" ||
    reconstructed.search ||
    reconstructed.hash
  ) {
    throw new Error("INVALID_HOST");
  }
  return reconstructed.origin;
}

export function assertAppRequest(
  request: Request,
  options: AppRequestOptions,
): void {
  if (request.headers.get(LOCAL_REQUEST_HEADER) !== LOCAL_REQUEST_HEADER_VALUE) {
    throw new Error("INVALID_LOCAL_REQUEST");
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite !== null && fetchSite !== "same-origin") {
    throw new Error("CROSS_ORIGIN_REQUEST");
  }

  const origin = request.headers.get("origin");
  if (
    (options.requireOrigin && origin === null) ||
    (origin !== null && origin !== applicationOrigin(request))
  ) {
    throw new Error("CROSS_ORIGIN_REQUEST");
  }

  if (options.requireJson) {
    const contentType = request.headers.get("content-type");
    if (contentType?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") {
      throw new Error("INVALID_CONTENT_TYPE");
    }
  }
}

export function isSecureApplicationRequest(request: Request): boolean {
  const url = new URL(request.url);
  const isLocalHttp =
    url.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  const forwardedProtocol = request.headers.get("x-forwarded-proto");
  if (forwardedProtocol !== null) {
    return forwardedProtocol === "https" ||
      (forwardedProtocol === "http" && isLocalHttp);
  }

  if (url.protocol === "https:") return true;
  return isLocalHttp;
}
