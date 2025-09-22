import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	OneToOne,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from "typeorm";
import { EscrowRequest } from "../requests/escrow-request.entity";
import { VirtualCoin } from "@arkade-os/sdk";

export const CONTRACT_STATUS = [
	// first status
	"created",
	// at least one unspent VTXO is present for the ARK address
	"funded",
	// all unspent VTXO have been spent
	"completed",

	// not funded in time
	"timed-out-funding",
	// sender didn't sign the spending path
	"timed-out-sender",
	// receiver didn't sign the spending path
	"timed-out-receiver",

	// canceled by the sender
	"canceled-by-sender",
	// canceled by the receiver
	"canceled-by-receiver",
	// canceled by the arbiter
	"canceled-by-arbiter",
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

	@Column({ type: "text", nullable: true })
	senderAddress!: string;

	@Index()
	@Column({ type: "text" })
	receiverPubkey!: string;

	@Column({ type: "text", nullable: true })
	receiverAddress!: string;

	@Column({ type: "integer" })
	amount!: number;

	@Index()
	@Column({ type: "text" })
	arkAddress!: string;

	@Column({ type: "text" })
	status!: ContractStatus;

	@Column({ type: "text", nullable: true })
	cancelationReason?: string;

	@Column({ type: "simple-json", nullable: true })
	virtualCoins?: VirtualCoin[];

	@CreateDateColumn()
	createdAt!: Date;

	@UpdateDateColumn()
	updatedAt!: Date;
}
