import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from "typeorm";

@Entity("users")
export class User {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Index({ unique: true })
	@Column({ type: "text" })
	publicKey!: string; // normalized x-only hex

	@Column({ type: "text", nullable: true })
	pendingChallenge?: string | null;

	@Column({ type: "text", nullable: true })
	challengeId?: string | null;

	@Column({ type: "datetime", nullable: true })
	challengeExpiresAt?: Date | null;

	@Column({ type: "datetime", nullable: true })
	lastLoginAt?: Date | null;

	@CreateDateColumn()
	createdAt!: Date;

	@UpdateDateColumn()
	updatedAt!: Date;
}
