import { z } from "zod";

export const appRunIdSchema = z.string().regex(
  /^llr_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
);

export type AppRunId = z.infer<typeof appRunIdSchema>;

export function createAppRunId(
  randomUUID: () => string = () => crypto.randomUUID(),
): AppRunId {
  return appRunIdSchema.parse(`llr_${randomUUID().toLowerCase()}`);
}
