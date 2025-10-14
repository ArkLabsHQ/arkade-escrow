export const ACTION_TYPE = [
	"release-funds",
	"return-funds",
	"direct-settle",
] as const;
export type ActionType = (typeof ACTION_TYPE)[number];
