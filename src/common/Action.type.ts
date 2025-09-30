export const ACTION_TYPE = ["dispute", "direct-settle"] as const;
export type ActionType = (typeof ACTION_TYPE)[number];
