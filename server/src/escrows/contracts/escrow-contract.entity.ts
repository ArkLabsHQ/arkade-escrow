import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from "typeorm";
import { EscrowRequest } from "../requests/escrow-request.entity";
import { VirtualCoin } from "@arkade-os/sdk";

export const CONTRACT_STATUS = [
	// first status, missing addresses
	"draft",
	// all addresses are set, but no unspent VTXO
	"created",
	// at least one unspent VTXO is present for the ARK address
	"funded",
	// execution created
	"pending-execution",
	// execution settled, all unspent VTXO have been spent
	"completed",

	// Cancelation possible only for `draft`
	"canceled-by-creator",
	"rejected-by-counterparty",

	// Rescission possible only for `created`
	"rescinded-by-creator",
	"rescinded-by-counterparty",

	// canceled by the arbiter
	"voided-by-arbiter",

	"under-arbitration",

	// TODO: should we cover some "timeout" scenarios?"
] as const;
export type ContractStatus = (typeof CONTRACT_STATUS)[number];

@Entity("escrow_contracts")
export class EscrowContract {
	@PrimaryGeneratedColumn()
	id!: number;

	@Index({ unique: true })
	@Column({ type: "text" })
	externalId!: string;

	@Index()
	@ManyToOne(() => EscrowRequest, { eager: true })
	@JoinColumn({ name: "requestExternalId", referencedColumnName: "externalId" })
	request!: EscrowRequest;

	@Index()
	@Column({ type: "text" })
	senderPubkey!: string;

	@Index()
	@Column({ type: "text" })
	receiverPubkey!: string;

	@Index()
	@Column({ type: "text" })
	receiverAddress?: string;

	@Column({ type: "integer" })
	amount!: number;

	@Index()
	@Column({ type: "text", nullable: true })
	arkAddress?: string;

	@Column({ type: "text", enum: CONTRACT_STATUS })
	status!: ContractStatus;

	@Column({ type: "text", nullable: true })
	cancelationReason?: string;

	@Column({ type: "simple-json", nullable: true })
	virtualCoins?: VirtualCoin[];

	@Column({ type: "text" })
	createdBy!: "sender" | "receiver";

	@CreateDateColumn()
	createdAt!: Date;

	@UpdateDateColumn()
	updatedAt!: Date;

	@Column({ type: "datetime", nullable: true })
	acceptedAt?: Date;

	@Column({ type: "datetime", nullable: true })
	canceledAt?: Date;
}
