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
import { EscrowRequest } from "../requests/escrow-request.entity";

@Entity("escrow_contracts")
export class EscrowContract {
	@PrimaryGeneratedColumn()
	id!: number;

	@Index({ unique: true })
	@Column({ type: "text" })
	externalId!: string;

	@Index({ unique: true })
	@OneToOne(() => EscrowRequest, { eager: true })
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
	@Column({ type: "text" })
	arkAddress!: string;

	@CreateDateColumn()
	createdAt!: Date;

	@UpdateDateColumn()
	updatedAt!: Date;
}
