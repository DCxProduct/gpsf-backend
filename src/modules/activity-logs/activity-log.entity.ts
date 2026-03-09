import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type ActivityLogChanges = Record<string, { before: unknown; after: unknown }>;
export type ActivityLogMetadata = Record<string, unknown>;

@Entity({ name: 'activity_logs' })
export class ActivityLogEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Index('IDX_activity_logs_kind')
  @Column({ type: 'varchar', length: 80 })
  kind: string;

  @Column({ type: 'varchar', length: 255 })
  activity: string;

  // Keep both module and resource: module is for UI display, resource is for backend grouping/filtering.
  @Index('IDX_activity_logs_module')
  @Column({ type: 'varchar', length: 120 })
  module: string;

  @Index('IDX_activity_logs_resource')
  @Column({ type: 'varchar', length: 120 })
  resource: string;

  @Column({ type: 'int', nullable: true })
  targetId?: number | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  targetType?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  targetLabel?: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  targetUrl?: string | null;

  @Index('IDX_activity_logs_actorId')
  @Column({ type: 'int', nullable: true })
  actorId?: number | null;

  @Column({ type: 'varchar', length: 190, nullable: true })
  actorName?: string | null;

  @Column({ type: 'varchar', length: 190, nullable: true })
  actorEmail?: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  actorImage?: string | null;

  // Save field-by-field before/after data for update detail view.
  @Column({ type: 'jsonb', nullable: true })
  changes?: ActivityLogChanges | null;

  // Extra request context such as IP or user-agent goes here.
  @Column({ type: 'jsonb', nullable: true })
  metadata?: ActivityLogMetadata | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}
