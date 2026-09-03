export type ServerEventCategory =
  | "browser_cleanup_failed"
  | "capture_deadline_exceeded"
  | "client_cleanup_failed"
  | "late_browser_cleanup_failed"
  | "late_client_cleanup_failed"
  | "replay_client_cleanup_failed"
  | "session_registered";

type CleanupServerEvent = {
  category: Exclude<ServerEventCategory, "session_registered">;
  requestId: string;
};

type SessionRegisteredEvent = {
  category: "session_registered";
  requestId: string;
  runId: string;
  country: string;
  attempt: number;
  sessionRef: string;
};

export type ServerEvent = CleanupServerEvent | SessionRegisteredEvent;

export function logServerEvent(event: ServerEvent): void {
  const serialized = JSON.stringify(event);
  if (event.category === "session_registered") console.info(serialized);
  else console.error(serialized);
}
