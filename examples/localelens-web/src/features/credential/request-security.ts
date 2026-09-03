import {
  LOCAL_REQUEST_HEADER,
  LOCAL_REQUEST_HEADER_VALUE,
} from "./protocol";

export type AppRequestOptions = {
  requireJson?: boolean;
  requireOrigin: boolean;
};

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
    (origin !== null && origin !== new URL(request.url).origin)
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
  const forwardedProtocol = request.headers.get("x-forwarded-proto");
  if (forwardedProtocol !== null) return forwardedProtocol === "https";

  const url = new URL(request.url);
  if (url.protocol === "https:") return true;
  return (
    url.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  );
}
