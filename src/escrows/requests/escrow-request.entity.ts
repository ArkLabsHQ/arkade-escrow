import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	PrimaryGeneratedColumn,
	Unique,
} from "typeorm";

export type EscrowSide = "receiver" | "sender";

@Entity("escrow_requests")
@Unique("uq_escrow_requests_external_id", ["externalId"])
export class EscrowRequest {
	@PrimaryGeneratedColumn() // INTEGER PRIMARY KEY AUTOINCREMENT (SQLite)
	id!: number; // internal only — do not expose

	@Index()
	@Column({ type: "text" })
	externalId!: string; // public, opaque (nanoid)

	@Column({ type: "text" })
	side!: EscrowSide;

	@Index()
	@Column({ type: "text" })
	pubkey!: string;

	@Column({ type: "integer", nullable: true })
	amount?: number | null;

	@Column({ type: "text" })
	description!: string;

	@Index()
	@Column({ type: "boolean", default: false })
	public!: boolean;

	@CreateDateColumn({ type: "datetime" })
	createdAt!: Date;
}
