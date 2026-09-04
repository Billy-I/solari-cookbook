export type ReplayEvent = {
  type: number;
  timestamp: number;
  data: Record<string, unknown>;
};
