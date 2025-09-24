import { ArkAddress } from "@arkade-os/sdk";

export type Sender = {
	_tag: "sender";

	/** Wallet address */
	address: ArkAddress;

	publicKey: string;
};

export type Receiver = {
	_tag: "receiver";

	/** Wallet address */
	address: ArkAddress;

	publicKey: string;
};

export const toSender = (publicKey: string, address: string): Sender => {
	const arkAddress = ArkAddress.decode(address);
	return { _tag: "sender", address: arkAddress, publicKey };
};

export const toReceiver = (publicKey: string, address: string): Receiver => {
	const arkAddress = ArkAddress.decode(address);
	return { _tag: "receiver", address: arkAddress, publicKey };
};

export type Contract = {
	_tag: "contract";
	sender: Sender;
	receiver: Receiver;
	arbitrator: { publicKey: string };
};

export const toContract = (
	sender: Sender,
	receiver: Receiver,
	arbitratorPublicKey: string,
): Contract => ({
	_tag: "contract",
	sender,
	receiver,
	arbitrator: { publicKey: arbitratorPublicKey },
});
