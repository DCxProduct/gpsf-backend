import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateActivityLogsTable1772306000000 implements MigrationInterface {
  name = 'CreateActivityLogsTable1772306000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "activity_logs" (
        "id" SERIAL NOT NULL,
        "kind" character varying(80) NOT NULL,
        "activity" character varying(255) NOT NULL,
        "module" character varying(120) NOT NULL,
        "resource" character varying(120) NOT NULL,
        "targetId" integer,
        "targetType" character varying(120),
        "targetLabel" character varying(255),
        "targetUrl" character varying(500),
        "actorId" integer,
        "actorName" character varying(190),
        "actorEmail" character varying(190),
        "actorImage" character varying(500),
        "changes" jsonb,
        "metadata" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_activity_logs_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_activity_logs_kind" ON "activity_logs" ("kind")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_activity_logs_module" ON "activity_logs" ("module")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_activity_logs_resource" ON "activity_logs" ("resource")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_activity_logs_actorId" ON "activity_logs" ("actorId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_activity_logs_createdAt" ON "activity_logs" ("createdAt" DESC)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_activity_logs_createdAt"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_activity_logs_actorId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_activity_logs_resource"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_activity_logs_module"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_activity_logs_kind"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "activity_logs"`);
  }
}
