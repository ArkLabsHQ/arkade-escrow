import { Logo } from "./Logo";
import { createContext, useContext, useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import Config from "@/Config";
import { useMessageBridge } from "@/components/MessageBus";
import { getAuth, setAuth } from "@/lib/storage";
import { Me } from "@/types/me";

interface Props {
	children: React.ReactNode;
}

type ChallengeResponse = {
	challenge: {
		scope: "signup";
		nonce: string;
		issuedAt: string;
	};
	challengeId: string;
	hashToSignHex: string;
	expiresAt: string;
};

const SessionContext = createContext<Me | undefined>(undefined);

export const SessionProvider = ({ children }: Props) => {
	const [dots, setDots] = useState("");
	const [signingChallenge, setSigningChallenge] = useState<boolean>(false);
	const { signChallenge, xPublicKey } = useMessageBridge();
	const [me, setMe] = useState<Me | undefined>(undefined);

	const signupChallenge = useMutation({
		mutationFn: (publicKey: string) => {
			return axios.post<ChallengeResponse>(
				`${Config.apiBaseUrl}/auth/signup/challenge`,
				{ publicKey },
			);
		},
	});

	type VerifySignupRequest = {
		signature: string;
		publicKey: string;
		challengeId: string;
	};
	type VerifySignupResponse = {
		accessToken: string;
		userId: string;
		publicKey: string;
	};
	const signupVerification = useMutation({
		mutationFn: (input: VerifySignupRequest) => {
			return axios.post<VerifySignupResponse>(
				`${Config.apiBaseUrl}/auth/signup/verify`,
				input,
			);
		},
	});

	useEffect(() => {
		const challengeResponse = signupChallenge.data?.data;

		if (!xPublicKey) {
			// still waiting for public key
			return;
		}

		if (me) {
			return;
		}

		const authData = getAuth();
		if (authData && authData.xPubKey === xPublicKey && !me) {
			console.log(`Logged in as ${xPublicKey}`);
			setMe(new Me(authData.xPubKey, authData.accessToken));
			return;
		}

		if (signupVerification.isIdle && !signingChallenge) {
			// no verification tried
			if (challengeResponse) {
				setSigningChallenge(true);
				signupChallenge.reset();
				signChallenge(challengeResponse.hashToSignHex).then((signature) =>
					signupVerification.mutate({
						signature,
						publicKey: xPublicKey,
						challengeId: challengeResponse.challengeId,
					}),
				);
			} else if (signupChallenge.isIdle) {
				signupChallenge.mutate(xPublicKey);
			}
		}

		if (signupVerification.isSuccess && signupVerification.data && !me) {
			setAuth({
				accessToken: signupVerification.data.data.accessToken,
				xPubKey: xPublicKey,
				// TODO: unused for now
				expirersAt: 0,
			});
			console.log(`Signed up as ${xPublicKey}`);
			setMe(new Me(xPublicKey, signupVerification.data.data.accessToken));
		} else if (signupVerification.isError) {
			console.error("Error verifying signup:", signupVerification.error);
			signupVerification.reset();
			setSigningChallenge(false);
		}
	}, [
		xPublicKey,
		signupChallenge,
		signChallenge,
		signupVerification,
		signingChallenge,
		me,
	]);

	useEffect(() => {
		const dotsInterval = setInterval(() => {
			setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
		}, 500);
		return () => {
			clearInterval(dotsInterval);
		};
	}, []);

	if (me) {
		return (
			<SessionContext.Provider value={me}>{children}</SessionContext.Provider>
		);
	}

	return (
		<div className="fixed inset-0 flex items-center justify-center bg-gradient-subtle">
			<div className="absolute inset-0 bg-gradient-shine opacity-50" />

			<div className="relative flex flex-col items-center space-y-8 animate-slide-up">
				<div className="relative">
					<div className="absolute inset-0 blur-2xl bg-primary/30 rounded-full animate-pulse-glow" />
					<div className="relative animate-spin-slow">
						<Logo size={80} />
					</div>
				</div>

				<div className="text-center space-y-2">
					<h2 className="text-2xl font-semibold text-foreground">
						Connecting to your wallet{dots}
					</h2>
					<p className="text-muted-foreground">
						Setting up your secure escrow environment
					</p>
				</div>

				<div className="w-64 h-1 bg-secondary rounded-full overflow-hidden">
					<div className="h-full bg-gradient-primary animate-shimmer" />
				</div>
			</div>
		</div>
	);
};

export function useSession(): Me {
	const ctx = useContext(SessionContext);
	if (!ctx) {
		throw new Error("useSession must be used within a SessionProvider");
	}
	return ctx;
}
