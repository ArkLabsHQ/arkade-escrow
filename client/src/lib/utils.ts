import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export const shortKey = (k: string) =>
	k.length > 14 ? `${k.slice(0, 10)}…${k.slice(-6)}` : k;
