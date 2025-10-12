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

	// Cancelation occurs after `created` or 'funded'
	// TODO:    How do we instruct the server to give the funds back in case of a cancellation?
	//          Probably the exit delay will guarantee that the funds are returned if the contract is never settled.
	"canceled-by-creator",
	"rejected-by-counterparty",
	// canceled by the arbiter
	"canceled-by-arbiter",

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

	@CreateDateColumn()
	createdAt!: Date;

	@UpdateDateColumn()
	updatedAt!: Date;

	@CreateDateColumn()
	acceptedAt!: Date;

	@UpdateDateColumn()
	canceledAt!: Date;
}
