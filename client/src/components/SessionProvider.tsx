import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Check } from "lucide-react";
import Config from "@/Config";
import { useAppShell } from "@/components/AppShell/RpcProvider";
import { getAuth, removeAuth, setAuth } from "@/lib/storage";
import { Me } from "@/types/me";
import { Logo } from "./Logo";

const phases = [
	{ id: 1, label: "Getting your public key" },
	{ id: 2, label: "Creating new session" },
	{ id: 3, label: "Done!" },
];

type Props = {
	children: React.ReactNode;
};

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

const SessionContext = createContext<
	{ me: Me; logout: () => void } | undefined
>(undefined);

export const SessionProvider = ({ children }: Props) => {
	const [currentPhase, setCurrentPhase] = useState(0);
	const [signingChallenge, setSigningChallenge] = useState<boolean>(false);
	const { signChallenge, xPublicKey } = useAppShell();
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

	// biome-ignore lint/correctness/useExhaustiveDependencies: WIP
	useEffect(() => {
		const challengeResponse = signupChallenge.data?.data;
		if (currentPhase === 0) setCurrentPhase(1);
		if (!xPublicKey) {
			// still waiting for public key
			return;
		}

		if (me) {
			setCurrentPhase(3);
			return;
		}

		const authData = getAuth();
		if (authData?.xPubKey !== xPublicKey) {
			// remove stale session
			removeAuth();
		}
		if (authData && authData.xPubKey === xPublicKey && !me) {
			setCurrentPhase(3);
			console.log(`[auth] Logged in as ${xPublicKey}`);
			axios
				.get<{ data: { publicKey: string } }>(
					`${Config.apiBaseUrl}/auth/session`,
					{
						headers: { authorization: `Bearer ${authData.accessToken}` },
					},
				)
				.then((res) => {
					if (res.data?.data.publicKey !== xPublicKey) {
						console.log("[auth] Stale session detected, removing it.");
						removeAuth();
						return;
					}
				})
				.catch(() => {
					console.log("[auth] Invalid session detected, removing it.");
					removeAuth();
				});
			setMe(new Me(authData.xPubKey, authData.accessToken));
			return;
		}

		if (signupVerification.isIdle && !signingChallenge) {
			if (currentPhase === 1) {
				setCurrentPhase(2);
			}
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
				expiresAt: 0,
			});
			console.log(`[auth] Signed up as ${xPublicKey}`);
			setMe(new Me(xPublicKey, signupVerification.data.data.accessToken));
		} else if (signupVerification.isError) {
			console.error("[auth] Error verifying signup:", signupVerification.error);
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
		const phase1Timer = setTimeout(() => setCurrentPhase(1), 800);
		const phase2Timer = setTimeout(() => setCurrentPhase(2), 1800);
		const phase3Timer = setTimeout(() => setCurrentPhase(3), 2600);
		return () => {
			clearTimeout(phase1Timer);
			clearTimeout(phase2Timer);
			clearTimeout(phase3Timer);
		};
	}, []);

	const logout = useCallback(() => {
		removeAuth();
		setMe(undefined);
		window.location.reload();
	}, []);

	if (me) {
		return (
			<SessionContext.Provider value={{ me, logout }}>
				{children}
			</SessionContext.Provider>
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

				<div className="text-center space-y-2 min-h-[60px]">
					<h2 className="text-2xl font-semibold text-foreground transition-all duration-300">
						{currentPhase > 0
							? phases[currentPhase - 1].label
							: "Initializing..."}
					</h2>
					<p className="text-muted-foreground">
						Setting up your secure escrow environment
					</p>
				</div>

				{/* Progress Bar with Phase Dots */}

				<div className="w-80 relative">
					{/* Background Track */}

					<div className="h-1 bg-secondary rounded-full overflow-hidden">
						<div
							className="h-full bg-gradient-primary transition-all duration-500 ease-out"
							style={{ width: `${(currentPhase / 3) * 100}%` }}
						/>
					</div>

					{/* Phase Dots */}

					<div className="absolute top-1/2 -translate-y-1/2 w-full flex justify-between px-1">
						{[0, 1, 2, 3].map((stop) => (
							<div
								key={stop}
								className="relative flex items-center justify-center"
							>
								<div
									className={`w-3 h-3 rounded-full border-2 transition-all duration-300 ${
										currentPhase > stop
											? "bg-primary border-primary scale-110"
											: currentPhase === stop
												? "bg-primary/50 border-primary animate-pulse"
												: "bg-background border-border"
									}`}
								>
									{currentPhase > stop && (
										<Check className="w-2 h-2 text-primary-foreground absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-scale-in" />
									)}
								</div>
							</div>
						))}
					</div>
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
	return ctx.me;
}

export function useLogout() {
	const ctx = useContext(SessionContext);
	if (!ctx) {
		throw new Error("useLogout must be used within a SessionProvider");
	}
	return ctx.logout;
}
