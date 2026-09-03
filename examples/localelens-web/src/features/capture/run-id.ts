export const APP_RUN_ID_PATTERN =
  /^llr_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export type AppRunId = string;

export function createAppRunId(
  randomUUID: () => string = () => crypto.randomUUID(),
): AppRunId {
  const runId = `llr_${randomUUID().toLowerCase()}`;
  if (!APP_RUN_ID_PATTERN.test(runId)) {
    throw new Error("Unable to create a valid application run ID.");
  }
  return runId as AppRunId;
}
