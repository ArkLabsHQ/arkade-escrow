import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
	Unique,
	UpdateDateColumn,
} from "typeorm";
import { EscrowContract } from "../contracts/escrow-contract.entity";

export const ARBITRATION_STATUS = ["pending", "resolved", "executed"] as const;
export type ArbitrationStatus = (typeof ARBITRATION_STATUS)[number];

export const VERDICT = ["refund", "release"] as const;
export type Verdict = (typeof VERDICT)[number];

@Entity("contract_arbitrations")
@Unique("uq_contract_arbitrations_external_id", ["externalId"])
export class ContractArbitration {
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
	claimantPubkey!: string;

	@Index()
	@Column({ type: "text" })
	defendantPubkey!: string;

	@Column({ type: "text" })
	reason!: string;

	@Column({ type: "text" })
	status!: ArbitrationStatus;

	@Column({ type: "text" })
	arbitratorPubkey!: string;

	@Column({ type: "text", nullable: true })
	verdict?: Verdict;

	@CreateDateColumn()
	createdAt!: Date;

	@UpdateDateColumn()
	updatedAt!: Date;
}
