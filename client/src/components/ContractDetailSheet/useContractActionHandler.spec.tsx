import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, act } from "@testing-library/react";
import axios from "axios";
// ✅ Mock this BEFORE importing the hook (jest.mock is hoisted, but keep it above for clarity)
const mockArkAddressDecode = jest.fn((_: string) => ({}) as never);
jest.mock("@arkade-os/sdk", () => ({
	__esModule: true,
	ArkAddress: {
		decode: (s: string) => mockArkAddressDecode(s),
	},
}));

import useContractActionHandler, {
	type ActionInput,
} from "./useContractActionHandler";
import { ExecutionTransaction } from "../../types/api";
import { ContractAction } from "@/components/ContractDetailSheet/ContractActions";

// ---- Mocks ----
jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.mock("@/Config", () => ({
	__esModule: true,
	default: { apiBaseUrl: "http://api.example.test" },
}));

const mockGetAccessToken = jest.fn(() => "ACCESS_TOKEN");
let mockSession: null | { getAccessToken: () => string } = {
	getAccessToken: mockGetAccessToken,
};

jest.mock("@/components/SessionProvider", () => ({
	useSession: () => mockSession,
}));

const SIGNED_TX = {
	tx: "SIGNED_TX",
	checkpoints: ["SIGNED_CP_1"],
};
const mockSignTransaction = jest.fn(async () => SIGNED_TX);
const mockFundAddress = jest.fn(async () => undefined);

jest.mock("@/components/AppShell/RpcProvider", () => ({
	useAppShell: () => ({
		signTransaction: mockSignTransaction,
		fundAddress: mockFundAddress,
	}),
}));

// ---- Helpers ----
async function runAction(
	result: { current: { handleAction: (input: ActionInput) => Promise<void> } },
	input: ActionInput,
) {
	await act(async () => {
		await result.current.handleAction(input);
	});
}

function createWrapper(): React.ComponentType<{ children?: unknown }> {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});

	const Wrapper: React.FC<{ children?: unknown }> = ({ children }) => {
		return (
			<QueryClientProvider client={queryClient}>
				{children as React.ReactElement}
			</QueryClientProvider>
		);
	};

	return Wrapper;
}

function baseInput(overrides: Partial<ActionInput> = {}): ActionInput {
	return {
		action: "accept-draft" as ActionInput["action"],
		contractId: "c_123",
		contractAmount: 123,
		transaction: null,
		...overrides,
	};
}

const HEADERS = { headers: { authorization: "Bearer ACCESS_TOKEN" } };

beforeEach(() => {
	jest.clearAllMocks();
	mockSession = { getAccessToken: mockGetAccessToken };
	mockedAxios.post.mockReset();
	mockedAxios.patch.mockReset();
	mockArkAddressDecode.mockImplementation(() => ({}) as never);
});

describe("useContractActionHandler", () => {
	describe("lockExecution", () => {
		it("prevents concurrent executions (second call returns early and does not trigger API)", async () => {
			mockedAxios.patch.mockImplementationOnce(() =>
				Promise.resolve({ data: {} }),
			);
			const { result } = renderHook(() => useContractActionHandler(), {
				wrapper: createWrapper(),
			});
			runAction(result, baseInput({ action: "accept-draft" }));
			// Second call while locked: should be ignored
			await runAction(result, baseInput({ action: "accept-draft" }));
			expect(mockedAxios.patch).toHaveBeenCalledTimes(1);
		});
	});

	describe("happy paths: action routing + correct calls", () => {
		it("accept-draft -> PATCH /accept with bearer token", async () => {
			mockedAxios.patch.mockResolvedValueOnce({});
			const { result } = renderHook(() => useContractActionHandler(), {
				wrapper: createWrapper(),
			});
			await runAction(result, baseInput({ action: "accept-draft" }));
			expect(mockedAxios.patch).toHaveBeenCalledWith(
				"http://api.example.test/escrows/contracts/c_123/accept",
				{},
				HEADERS,
			);
		});

		it("reject-draft -> PATCH /reject with reason", async () => {
			mockedAxios.patch.mockResolvedValueOnce({});
			const { result } = renderHook(() => useContractActionHandler(), {
				wrapper: createWrapper(),
			});
			await runAction(
				result,
				baseInput({ action: "reject-draft", reason: "nope" }),
			);
			expect(mockedAxios.patch).toHaveBeenCalledWith(
				"http://api.example.test/escrows/contracts/c_123/reject",
				{ reason: "nope" },
				HEADERS,
			);
		});

		it("cancel-draft -> PATCH /cancel with reason", async () => {
			mockedAxios.patch.mockResolvedValueOnce({});
			const { result } = renderHook(() => useContractActionHandler(), {
				wrapper: createWrapper(),
			});
			await runAction(
				result,
				baseInput({ action: "cancel-draft", reason: "changed mind" }),
			);
			expect(mockedAxios.patch).toHaveBeenCalledWith(
				"http://api.example.test/escrows/contracts/c_123/cancel",
				{ reason: "changed mind" },
				HEADERS,
			);
		});

		it("fund-contract -> calls fundAddress(contractArkAddress, contractAmount)", async () => {
			const { result } = renderHook(() => useContractActionHandler(), {
				wrapper: createWrapper(),
			});
			await runAction(
				result,
				baseInput({
					action: "fund-contract",
					contractArkAddress: "ark_addr_1",
					contractAmount: 999,
				}),
			);
			expect(mockFundAddress).toHaveBeenCalledWith("ark_addr_1", 999);
		});

		it("update-release-address -> validates address and PATCHes contract", async () => {
			mockedAxios.patch.mockResolvedValueOnce({});
			const { result } = renderHook(() => useContractActionHandler(), {
				wrapper: createWrapper(),
			});
			await runAction(
				result,
				baseInput({
					action: "update-release-address",
					newReleaseAddress: "ark_release_1",
				}),
			);
			expect(mockArkAddressDecode).toHaveBeenCalledWith("ark_release_1");
			expect(mockedAxios.patch).toHaveBeenCalledWith(
				"http://api.example.test/escrows/contracts/c_123",
				{ releaseAddress: "ark_release_1" },
				HEADERS,
			);
		});

		it("execute (no existing execution) -> POST /execute then sign + PATCH execution", async () => {
			const data = {
				externalId: "exec_1",
				arkTx: "ARK_TX_RAW",
				checkpoints: ["CP_1", "CP_2"],
			};
			mockedAxios.post.mockResolvedValueOnce({
				status: 201,
				statusText: "Created",
				data: { data },
			} as never);
			mockedAxios.patch.mockResolvedValueOnce({});
			const { result } = renderHook(() => useContractActionHandler(), {
				wrapper: createWrapper(),
			});
			await runAction(
				result,
				baseInput(
					baseInput({
						action: "execute",
						receiverAddress: "receiver_ark_addr",
					}),
				),
			);
			expect(mockedAxios.post).toHaveBeenCalledWith(
				"http://api.example.test/escrows/contracts/c_123/execute",
				{ arkAddress: "receiver_ark_addr" },
				HEADERS,
			);
			expect(mockSignTransaction).toHaveBeenCalledWith(
				data.arkTx,
				data.checkpoints,
			);
			expect(mockedAxios.patch).toHaveBeenCalledWith(
				"http://api.example.test/escrows/contracts/c_123/executions/exec_1",
				{ arkTx: SIGNED_TX.tx, checkpoints: SIGNED_TX.checkpoints },
				HEADERS,
			);
		});

		it("execute (existing transaction+executionId) -> approves execution (sign + PATCH)", async () => {
			mockedAxios.patch.mockResolvedValueOnce({});
			const { result } = renderHook(() => useContractActionHandler(), {
				wrapper: createWrapper(),
			});
			await runAction(
				result,
				baseInput({
					action: "execute",
					executionId: "exec_99",
					transaction: {
						arkTx: "TX_TO_SIGN",
						checkpoints: ["C1"],
					} as ExecutionTransaction,
				}),
			);
			expect(mockSignTransaction).toHaveBeenCalledWith("TX_TO_SIGN", ["C1"]);
			expect(mockedAxios.patch).toHaveBeenCalledWith(
				"http://api.example.test/escrows/contracts/c_123/executions/exec_99",
				{ arkTx: SIGNED_TX.tx, checkpoints: SIGNED_TX.checkpoints },
				HEADERS,
			);
		});

		it("approve -> signs and PATCHes execution", async () => {
			mockedAxios.patch.mockResolvedValueOnce({});
			const { result } = renderHook(() => useContractActionHandler(), {
				wrapper: createWrapper(),
			});
			await runAction(
				result,
				baseInput({
					action: "approve",
					executionId: "exec_2",
					transaction: {
						arkTx: "TX_APPROVE",
						checkpoints: ["C9"],
					} as ExecutionTransaction,
				}),
			);

			expect(mockSignTransaction).toHaveBeenCalledWith("TX_APPROVE", ["C9"]);
			expect(mockedAxios.patch).toHaveBeenCalledWith(
				"http://api.example.test/escrows/contracts/c_123/executions/exec_2",
				{ arkTx: SIGNED_TX.tx, checkpoints: SIGNED_TX.checkpoints },
				HEADERS,
			);
		});

		it("dispute -> POST /arbitrations", async () => {
			mockedAxios.post.mockResolvedValueOnce({});
			const { result } = renderHook(() => useContractActionHandler(), {
				wrapper: createWrapper(),
			});
			await runAction(
				result,
				baseInput({ action: "dispute", reason: "because" }),
			);

			expect(mockedAxios.post).toHaveBeenCalledWith(
				"http://api.example.test/escrows/arbitrations",
				{ contractId: "c_123", reason: "because" },
				HEADERS,
			);
		});

		it("create-execution-for-dispute -> validates address, POST arbitration execute, sign, then PATCH execution", async () => {
			mockedAxios.post.mockResolvedValueOnce({
				status: 201,
				statusText: "Created",
				data: {
					data: {
						externalId: "exec_dispute_1",
						arkTx: "DISPUTE_ARK_TX",
						checkpoints: ["D1"],
					},
				},
			} as never);
			mockedAxios.patch.mockResolvedValueOnce({} as never);
			const { result } = renderHook(() => useContractActionHandler(), {
				wrapper: createWrapper(),
			});
			await runAction(
				result,
				baseInput({
					action: "create-execution-for-dispute",
					disputeId: "disp_1",
					arbitrationTransferAddress: "ark_transfer_1",
				}),
			);
			expect(mockArkAddressDecode).toHaveBeenCalledWith("ark_transfer_1");
			expect(mockedAxios.post).toHaveBeenCalledWith(
				"http://api.example.test/escrows/arbitrations/disp_1/execute",
				{ arkAddress: "ark_transfer_1" },
				HEADERS,
			);
			expect(mockSignTransaction).toHaveBeenCalledWith("DISPUTE_ARK_TX", [
				"D1",
			]);
			expect(mockedAxios.patch).toHaveBeenCalledWith(
				"http://api.example.test/escrows/contracts/c_123/executions/exec_dispute_1",
				{ arkTx: SIGNED_TX.tx, checkpoints: SIGNED_TX.checkpoints },
				HEADERS,
			);
		});

		it("recede-created -> PATCH /recede with reason", async () => {
			mockedAxios.patch.mockResolvedValueOnce({});
			const { result } = renderHook(() => useContractActionHandler(), {
				wrapper: createWrapper(),
			});
			await runAction(
				result,
				baseInput({ action: "recede-created", reason: "leaving" }),
			);
			expect(mockedAxios.patch).toHaveBeenCalledWith(
				"http://api.example.test/escrows/contracts/c_123/recede",
				{ reason: "leaving" },
				HEADERS,
			);
		});
	});

	describe("errors / validation", () => {
		it("fund-contract throws if contractArkAddress missing", async () => {
			const { result } = renderHook(() => useContractActionHandler(), {
				wrapper: createWrapper(),
			});
			await expect(
				runAction(result, baseInput({ action: "fund-contract" })),
			).rejects.toThrow("Contract ARK address is required for funding");
		});

		it("update-release-address throws if newReleaseAddress missing", async () => {
			const { result } = renderHook(() => useContractActionHandler(), {
				wrapper: createWrapper(),
			});
			await expect(
				runAction(result, baseInput({ action: "update-release-address" })),
			).rejects.toThrow("Invalid ARK address provided");
		});

		it("update-release-address throws 'Invalid ARK address provided' when ArkAddress.decode throws", async () => {
			mockArkAddressDecode.mockImplementationOnce(() => {
				throw new Error("bad addr");
			});
			const { result } = renderHook(() => useContractActionHandler(), {
				wrapper: createWrapper(),
			});
			await expect(
				runAction(
					result,
					baseInput({
						action: "update-release-address",
						newReleaseAddress: "not_valid",
					}),
				),
			).rejects.toThrow("Invalid ARK address provided");
		});

		it("approve throws if transaction or executionId missing", async () => {
			const { result } = renderHook(() => useContractActionHandler(), {
				wrapper: createWrapper(),
			});
			await expect(
				runAction(result, baseInput({ action: "approve" })),
			).rejects.toThrow("Transaction is required for approval");
		});

		it("create-execution-for-dispute throws if disputeId or arbitrationTransferAddress missing", async () => {
			const { result } = renderHook(() => useContractActionHandler(), {
				wrapper: createWrapper(),
			});
			await expect(
				runAction(
					result,
					baseInput({
						action: "create-execution-for-dispute",
						disputeId: "disp_1",
					}),
				),
			).rejects.toThrow("An ARK address is required for dispute execution");
		});

		it("create-execution-for-dispute propagates ArkAddress.decode error", async () => {
			mockArkAddressDecode.mockImplementationOnce(() => {
				throw new Error("invalid");
			});
			const { result } = renderHook(() => useContractActionHandler(), {
				wrapper: createWrapper(),
			});
			await expect(
				runAction(
					result,
					baseInput({
						action: "create-execution-for-dispute",
						disputeId: "disp_1",
						arbitrationTransferAddress: "bad_addr",
					}),
				),
			).rejects.toThrow("invalid");
		});

		it("invalid action -> rejects with 'Invalid action ...'", async () => {
			const { result } = renderHook(() => useContractActionHandler(), {
				wrapper: createWrapper(),
			});
			await expect(
				runAction(
					result,
					baseInput({ action: "do-a-backflip" as ContractAction }),
				),
			).rejects.toThrow("Invalid action do-a-backflip");
		});
	});
});
