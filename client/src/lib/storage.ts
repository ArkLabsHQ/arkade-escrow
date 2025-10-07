export type AuthData = {
	accessToken: string;
	xPubKey: string;
	expirersAt: number;
};

export function setAuth(data: AuthData): void {
	localStorage.setItem("ark:auth", JSON.stringify(data));
}

export function getAuth() {
	const data = localStorage.getItem("ark:auth");
	return data ? (JSON.parse(data) as AuthData) : null;
}
