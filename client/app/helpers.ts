export const shortKey = (k: string) =>
	k.length > 14 ? `${k.slice(0, 10)}…${k.slice(-6)}` : k;
