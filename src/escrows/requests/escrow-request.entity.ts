import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	PrimaryGeneratedColumn,
	Unique,
	UpdateDateColumn,
} from "typeorm";

export type RequestSide = "receiver" | "sender";
export type RequestStatus = "open" | "accepted" | "cancelled";

@Entity("escrow_requests")
@Unique("uq_escrow_requests_external_id", ["externalId"])
export class EscrowRequest {
	@PrimaryGeneratedColumn()
	id!: number;

	@Index({ unique: true })
	@Column({ type: "text" })
	externalId!: string;

	@Index()
	@Column({ type: "text" })
	creatorPubkey!: string;

	@Column({ type: "text" })
	side!: RequestSide;

	@Column({ type: "integer", nullable: true })
	amount?: number;

	@Column({ type: "text" })
	description!: string;

	@Index()
	@Column({ type: "boolean", default: true })
	public!: boolean;

	@Column({ type: "text", default: "open" })
	status!: RequestStatus;

	@Column({ type: "text", nullable: true })
	acceptedByPubkey?: string;

	@CreateDateColumn()
	createdAt!: Date;

	@UpdateDateColumn()
	updatedAt!: Date;
}
