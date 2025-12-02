import { GetEscrowRequestDto } from "@/types/api";
import { CreateContractAsReceiver } from "@/components/ContractCreationWizard/CreateContractAsReceiver";
import { CreateContractAsSender } from "@/components/ContractCreationWizard/CreateContractAsSender";

type Props = {
	request: GetEscrowRequestDto;
	open: boolean;
	initialReleaseAddress?: string;
	onOpenChange: (open: boolean) => void;
	onCreateContract: (requestId: string, releaseAddress?: string) => void;
};

export const ContractCreationWizard = ({
	request,
	open,
	initialReleaseAddress,
	onOpenChange,
	onCreateContract,
}: Props) => {
	const mySide = request.side === "receiver" ? "sender" : "receiver";
	if (mySide === "receiver") {
		return (
			<CreateContractAsReceiver
				request={request}
				open={open}
				initialReleaseAddress={initialReleaseAddress}
				onOpenChange={onOpenChange}
				onCreateContract={onCreateContract}
			/>
		);
	}
	return (
		<CreateContractAsSender
			request={request}
			open={open}
			onOpenChange={onOpenChange}
			onCreateContract={onCreateContract}
		/>
	);
};
