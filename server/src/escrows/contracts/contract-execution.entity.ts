import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	OneToMany,
	OneToOne,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from "typeorm";
import { EscrowContract } from "./escrow-contract.entity";
import { Signers } from "../../ark/escrow";
import { PublicKey } from "../../common/PublicKey";

import { ACTION_TYPE, ActionType } from "../../common/Action.type";

export const EXECUTION_STATUS = [
	"pending-initiator-signature",
	"pending-counterparty-signature",
	"pending-server-confirmation",
	"executed",

	// voided
	"canceled-by-initiator",
	"rejected-by-counterparty",
] as const;
export type ExecutionStatus = (typeof EXECUTION_STATUS)[number];

export type ExecutionTransaction = {
	vtxo: {
		txid: string;
		vout: number;
		value: number;
	};
	arkTx: string; // The Ark transaction as PSBT
	checkpoints: string[]; // Checkpoint transactions as PSBTs
	requiredSigners: Signers[];
	approvedByPubKeys: PublicKey[]; // List of pubkeys who have approved
	rejectedByPubKeys: PublicKey[]; // List of pubkeys who have rejected
};

@Entity("contract_executions")
export class ContractExecution {
	@PrimaryGeneratedColumn()
	id!: number;

	@Index({ unique: true })
	@Column({ type: "text" })
	externalId!: string;

	@Index()
	@ManyToOne(() => EscrowContract, { eager: true })
	@JoinColumn({
		name: "contractExternalId",
		referencedColumnName: "externalId",
	})
	contract!: EscrowContract;

	@Index()
	@Column({ type: "text" })
	initiatedByPubKey!: string;

	@Column({ type: "text", enum: ACTION_TYPE })
	action!: ActionType;

	@Column({ type: "text" })
	status!: ExecutionStatus;

	@Column({ type: "text", nullable: true })
	rejectionReason?: string;

	@Column({ type: "text", nullable: true })
	cancelationReason?: string;

	@Column({ type: "simple-json" })
	transaction!: ExecutionTransaction;

	@CreateDateColumn()
	createdAt!: Date;

	@UpdateDateColumn()
	updatedAt!: Date;
}
