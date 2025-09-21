import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	JoinColumn,
	OneToOne,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from "typeorm";
import { EscrowContract } from "./escrow-contract.entity";

export const EXECUTION_STATUS = [
	"pending-initiator-signature",
	"pending-counterparty-signature",
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
	arkTx: number[]; // The Ark transaction as PSBT
	checkpoints: number[][]; // Checkpoint transactions as PSBTs
	requiredSignersPubKeys: string[];
	approvedByPubKeys: string[]; // List of pubkeys who have approved
	rejectedByPubKeys: string[]; // List of pubkeys who have rejected
};

@Entity("contract_executions")
export class ContractExecution {
	@PrimaryGeneratedColumn()
	id!: number;

	@Index({ unique: true })
	@Column({ type: "text" })
	externalId!: string;

	@Index()
	@OneToOne(() => EscrowContract, { eager: true })
	@JoinColumn({
		name: "contractExternalId",
		referencedColumnName: "externalId",
	})
	contract!: EscrowContract;

	@Index()
	@Column({ type: "text" })
	initiatedByPubKey!: string;

	@Column({ type: "text", default: "created" })
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
