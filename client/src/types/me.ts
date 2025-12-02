import { shortKey } from "@/lib/utils";

export class Me {
	constructor(
		private xPubKey: string,
		private accessToken: string,
	) {}

	pubkeyAsMe(k: string) {
		return this.xPubKey === k ? "You" : shortKey(k);
	}

	isMyPubkey(k: string) {
		return this.xPubKey === k;
	}

	getAccessToken() {
		return this.accessToken;
	}

	getXPubKey() {
		return this.xPubKey;
	}
}
