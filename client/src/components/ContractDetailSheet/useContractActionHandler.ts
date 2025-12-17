import { ContractAction } from "@/components/ContractDetailSheet/ContractActions";
import {
	ExecuteEscrowContractOutDto,
	GetEscrowContractDto,
	GetExecutionByContractDto,
	Side,
} from "@/types/api";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import Config from "@/Config";
import { ApiEnvelope } from "../../../../server/src/common/dto/envelopes";
import { useSession } from "@/components/SessionProvider";
import { useAppShell } from "@/components/AppShell/RpcProvider";
import { useCallback, useRef, useState } from "react";
import { ArkAddress } from "@arkade-os/sdk";

export type ActionInput = {
	action: ContractAction;
	contractId: string;
	contractAmount: number;
	contractArkAddress?: string;
	executionId?: string;
	disputeId?: string;
	transaction: GetExecutionByContractDto["transaction"] | null;
	reason?: string;
	newReleaseAddress?: string;
	receiverAddress?: string;
	arbitrationTransferAddress?: string;
	mySide: Side;
};

export default function useContractActionHandler(): {
	handleAction: (input: ActionInput) => Promise<void>;
} {
	const { signTransaction, fundAddress } = useAppShell();
	const me = useSession();

	// need a ref to work with promises
	const isExecuting = useRef(false);

	const acceptContract = useMutation({
		mutationFn: async (contractId: string) => {
			const res = await axios.patch<GetEscrowContractDto>(
				`${Config.apiBaseUrl}/escrows/contracts/${contractId}/accept`,
				{},
				{ headers: { authorization: `Bearer ${me.getAccessToken()}` } },
			);
			return res.data;
		},
	});

	const executeContract = useMutation({
		mutationFn: async (input: { contractId: string; arkAddress?: string }) => {
			const res = await axios.post<ApiEnvelope<ExecuteEscrowContractOutDto>>(
				`${Config.apiBaseUrl}/escrows/contracts/${input.contractId}/execute`,
				{ arkAddress: input.arkAddress },
				{ headers: { authorization: `Bearer ${me.getAccessToken()}` } },
			);
			if (res.status !== 201) {
				throw new Error("Failed to execute contract", {
					cause: new Error(`${res.status} - ${res.statusText}`),
				});
			}
			const { externalId, arkTx, checkpoints } = res.data.data;
			const signed = await signTransaction(arkTx, checkpoints);
			await axios.patch(
				`${Config.apiBaseUrl}/escrows/contracts/${input.contractId}/executions/${externalId}`,
				{
					arkTx: signed.tx,
					checkpoints: signed.checkpoints,
				},
				{ headers: { authorization: `Bearer ${me.getAccessToken()}` } },
			);
		},
	});

	const rejectContract = useMutation({
		mutationFn: async (input: { contractId: string; reason: string }) => {
			await axios.patch(
				`${Config.apiBaseUrl}/escrows/contracts/${input.contractId}/reject`,
				{
					reason: input.reason,
				},
				{ headers: { authorization: `Bearer ${me.getAccessToken()}` } },
			);
		},
	});

	const cancelContract = useMutation({
		mutationFn: async (input: { contractId: string; reason: string }) => {
			await axios.patch(
				`${Config.apiBaseUrl}/escrows/contracts/${input.contractId}/cancel`,
				{
					reason: input.reason,
				},
				{ headers: { authorization: `Bearer ${me.getAccessToken()}` } },
			);
		},
	});

	const approveContractExecution = useMutation({
		mutationFn: async (input: {
			contractId: string;
			executionId: string;
			transaction: { arkTx: string; checkpoints: string[] };
		}) => {
			if (me === null) {
				throw new Error("User not authenticated");
			}
			const signed = await signTransaction(
				input.transaction.arkTx,
				input.transaction.checkpoints,
			);
			await axios.patch(
				`${Config.apiBaseUrl}/escrows/contracts/${input.contractId}/executions/${input.executionId}`,
				{
					arkTx: signed.tx,
					checkpoints: signed.checkpoints,
				},
				{ headers: { authorization: `Bearer ${me.getAccessToken()}` } },
			);
		},
	});

	const recedeFromContract = useMutation({
		mutationFn: async (input: { contractId: string; reason: string }) =>
			axios.patch(
				`${Config.apiBaseUrl}/escrows/contracts/${input.contractId}/recede`,
				{
					reason: input.reason,
				},
				{ headers: { authorization: `Bearer ${me.getAccessToken()}` } },
			),
	});

	const updateReleaseAddress = useMutation({
		mutationFn: async (input: { contractId: string; releaseAddress: string }) =>
			axios.patch(
				`${Config.apiBaseUrl}/escrows/contracts/${input.contractId}`,
				{
					releaseAddress: input.releaseAddress,
				},
				{ headers: { authorization: `Bearer ${me.getAccessToken()}` } },
			),
	});

	const createExecutionForDispute = useMutation({
		mutationFn: async (input: {
			contractId: string;
			disputeId: string;
			arkAddress: string;
		}) => {
			const res = await axios.post<ApiEnvelope<ExecuteEscrowContractOutDto>>(
				`${Config.apiBaseUrl}/escrows/arbitrations/${input.disputeId}/execute`,
				{ arkAddress: input.arkAddress },
				{ headers: { authorization: `Bearer ${me.getAccessToken()}` } },
			);
			if (res.status !== 201) {
				throw new Error("Failed to execute arbitration", {
					cause: new Error(`${res.status} - ${res.statusText}`),
				});
			}
			const { externalId, arkTx, checkpoints } = res.data.data;
			const signed = await signTransaction(arkTx, checkpoints);

			return axios.patch(
				`${Config.apiBaseUrl}/escrows/contracts/${input.contractId}/executions/${externalId}`,
				{
					arkTx: signed.tx,
					checkpoints: signed.checkpoints,
				},
				{ headers: { authorization: `Bearer ${me.getAccessToken()}` } },
			);
		},
	});

	const requestArbitration = useMutation({
		mutationFn: async (input: { contractId: string; reason: string }) => {
			await axios.post(
				`${Config.apiBaseUrl}/escrows/arbitrations`,
				{
					contractId: input.contractId,
					reason: input.reason,
				},
				{ headers: { authorization: `Bearer ${me.getAccessToken()}` } },
			);
		},
	});

	const lockExecution = useCallback(async (task: () => Promise<unknown>) => {
		if (isExecuting.current) return;
		isExecuting.current = true;
		try {
			await task();
		} finally {
			isExecuting.current = false;
		}
		return;
	}, []);

	const handleAction = async ({
		action,
		contractId,
		contractArkAddress,
		contractAmount,
		reason,
		newReleaseAddress,
		transaction,
		executionId,
		disputeId,
		receiverAddress,
		arbitrationTransferAddress,
		mySide,
	}: ActionInput) => {
		switch (action) {
			case "accept-draft":
				return lockExecution(() => acceptContract.mutateAsync(contractId));
			case "reject-draft": {
				if (!reason) {
					throw new Error("Reason is required for rejection");
				}
				return lockExecution(() =>
					rejectContract.mutateAsync({ contractId, reason }, {}),
				);
			}
			case "cancel-draft":
				if (!reason) {
					throw new Error("Reason is required for rejection");
				}
				return lockExecution(() =>
					cancelContract.mutateAsync({ contractId, reason }, {}),
				);
			case "fund-contract":
				if (!contractArkAddress) {
					throw new Error("Contract ARK address is required for funding");
				}
				return lockExecution(() =>
					fundAddress(contractArkAddress, contractAmount),
				);
			case "update-release-address":
				try {
					if (!newReleaseAddress) {
						throw new Error("New release address is required for updating");
					}
					ArkAddress.decode(newReleaseAddress);
					return lockExecution(() =>
						updateReleaseAddress.mutateAsync({
							contractId,
							releaseAddress: newReleaseAddress,
						}),
					);
				} catch (e) {
					throw new Error("Invalid ARK address provided");
				}
			case "execute":
				if (transaction && executionId) {
					return lockExecution(() =>
						approveContractExecution.mutateAsync({
							contractId,
							executionId,
							transaction,
						}),
					);
				}
				return lockExecution(() =>
					executeContract.mutateAsync({
						contractId,
						// only the receiver can initiate an execution with a release address (validated also on API)
						arkAddress: mySide === "receiver" ? receiverAddress : undefined,
					}),
				);
			case "approve":
				if (!transaction || !executionId) {
					throw new Error("Transaction is required for approval");
				}
				return lockExecution(() =>
					approveContractExecution.mutateAsync({
						contractId,
						executionId,
						transaction,
					}),
				);
			case "dispute":
				if (!reason) {
					throw new Error("Reason is required for dispute");
				}
				return lockExecution(() =>
					requestArbitration.mutateAsync({ contractId, reason }, {}),
				);
			case "create-execution-for-dispute":
				if (!disputeId || !arbitrationTransferAddress) {
					throw new Error("An ARK address is required for dispute execution");
				}
				ArkAddress.decode(arbitrationTransferAddress);
				return lockExecution(() =>
					createExecutionForDispute.mutateAsync({
						contractId,
						disputeId,
						arkAddress: arbitrationTransferAddress,
					}),
				);
			case "recede-created":
				if (!reason) {
					throw new Error("Reason is required for receding");
				}
				return lockExecution(() =>
					recedeFromContract.mutateAsync({ contractId, reason }),
				);
			default:
				return Promise.reject(new Error(`Invalid action ${action}`));
		}
	};

	return { handleAction };
}
