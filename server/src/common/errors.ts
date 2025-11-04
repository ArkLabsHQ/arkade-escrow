export function toError(err: unknown): Error {
	return err instanceof Error
		? err
		: new Error("Invalid error type", { cause: err });
}
