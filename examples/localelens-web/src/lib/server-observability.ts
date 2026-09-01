export type ServerEventCategory =
  | "browser_cleanup_failed"
  | "capture_deadline_exceeded"
  | "client_cleanup_failed"
  | "replay_client_cleanup_failed";

export function logServerEvent(
  category: ServerEventCategory,
  requestId: string,
): void {
  console.error(JSON.stringify({ category, requestId }));
}
