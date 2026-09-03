"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  LOCAL_REQUEST_HEADER,
  LOCAL_REQUEST_HEADER_VALUE,
} from "@/src/features/credential/protocol";

export type SolariConnectionState =
  | "checking"
  | "missing"
  | "entered"
  | "authenticating"
  | "authentication_failed"
  | "authentication_unavailable"
  | "ready"
  | "disconnecting";

export type SolariConnectionController = {
  apiKey: string;
  setApiKey(value: string): void;
  state: SolariConnectionState;
  message: string | null;
  ready: boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  markAuthenticationFailed(): void;
};

type StatusResponse =
  | { status: "missing" }
  | { status: "ready" }
  | {
      status: "authentication_failed" | "authentication_unavailable";
      message: string;
    };

const stateMessages: Partial<Record<SolariConnectionState, string>> = {
  authenticating: "Authenticating…",
  authentication_failed: "Authentication failed",
  authentication_unavailable: "Authentication is unavailable",
  checking: "Checking this browser session",
  disconnecting: "Disconnecting…",
  ready: "Ready for this session",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  return (
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

function parseStatusResponse(value: unknown): StatusResponse | null {
  if (!isRecord(value) || typeof value.status !== "string") return null;
  if (
    (value.status === "missing" || value.status === "ready") &&
    hasExactKeys(value, ["status"])
  ) {
    return { status: value.status };
  }
  if (
    (value.status === "authentication_failed" ||
      value.status === "authentication_unavailable") &&
    hasExactKeys(value, ["status", "message"]) &&
    typeof value.message === "string" &&
    value.message.length > 0 &&
    value.message.length <= 240
  ) {
    return { status: value.status, message: value.message };
  }
  return null;
}

async function readStatus(response: Response): Promise<StatusResponse | null> {
  try {
    return parseStatusResponse(await response.json());
  } catch {
    return null;
  }
}

export function useSolariConnection(): SolariConnectionController {
  const [apiKey, setApiKeyState] = useState("");
  const [state, setState] = useState<SolariConnectionState>("checking");
  const apiKeyRef = useRef("");
  const controllersRef = useRef(new Set<AbortController>());
  const mountedRef = useRef(true);
  const connectInFlightRef = useRef(false);

  const request = useCallback(async (input: RequestInfo, init: RequestInit) => {
    const controller = new AbortController();
    controllersRef.current.add(controller);
    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } finally {
      controllersRef.current.delete(controller);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void (async () => {
      try {
        const response = await request("/api/solari-session", {
          cache: "no-store",
          headers: { [LOCAL_REQUEST_HEADER]: LOCAL_REQUEST_HEADER_VALUE },
        });
        const parsed = await readStatus(response);
        if (!mountedRef.current || apiKeyRef.current.length > 0) return;
        setState(parsed?.status ?? "authentication_unavailable");
      } catch {
        if (mountedRef.current && apiKeyRef.current.length === 0) {
          setState("authentication_unavailable");
        }
      }
    })();

    return () => {
      mountedRef.current = false;
      for (const controller of controllersRef.current) controller.abort();
      controllersRef.current.clear();
    };
  }, [request]);

  const setApiKey = useCallback((value: string) => {
    apiKeyRef.current = value;
    setApiKeyState(value);
    setState(value.length > 0 ? "entered" : "missing");
  }, []);

  const connect = useCallback(async () => {
    const submittedKey = apiKeyRef.current;
    if (connectInFlightRef.current || submittedKey.length === 0) return;

    connectInFlightRef.current = true;
    apiKeyRef.current = "";
    setApiKeyState("");
    setState("authenticating");
    try {
      const response = await request("/api/solari-session", {
        body: JSON.stringify({ apiKey: submittedKey }),
        headers: {
          "Content-Type": "application/json",
          [LOCAL_REQUEST_HEADER]: LOCAL_REQUEST_HEADER_VALUE,
        },
        method: "POST",
      });
      const parsed = await readStatus(response);
      if (!mountedRef.current) return;
      setState(parsed?.status ?? "authentication_unavailable");
    } catch {
      if (mountedRef.current) setState("authentication_unavailable");
    } finally {
      connectInFlightRef.current = false;
    }
  }, [request]);

  const disconnect = useCallback(async () => {
    apiKeyRef.current = "";
    setApiKeyState("");
    setState("disconnecting");
    try {
      await request("/api/solari-session", {
        headers: { [LOCAL_REQUEST_HEADER]: LOCAL_REQUEST_HEADER_VALUE },
        method: "DELETE",
      });
    } catch {
      // The browser must forget the local ready state even if DELETE is unavailable.
    } finally {
      if (mountedRef.current) setState("missing");
    }
  }, [request]);

  const markAuthenticationFailed = useCallback(() => {
    apiKeyRef.current = "";
    setApiKeyState("");
    setState("authentication_failed");
  }, []);

  return {
    apiKey,
    connect,
    disconnect,
    markAuthenticationFailed,
    message: stateMessages[state] ?? null,
    ready: state === "ready",
    setApiKey,
    state,
  };
}
