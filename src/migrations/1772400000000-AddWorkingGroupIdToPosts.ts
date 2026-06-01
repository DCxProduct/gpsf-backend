import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds workingGroupId (FK to working_groups.id) to posts so a post can be
 * tagged with the Working Group it belongs to. Single FK because each post
 * has one home WG today; we can migrate to a join table later if needed.
 *
 * ON DELETE SET NULL: dropping a WG should orphan its posts, not cascade-delete.
 */
export class AddWorkingGroupIdToPosts1772400000000 implements MigrationInterface {
  name = 'AddWorkingGroupIdToPosts1772400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "posts"
      ADD COLUMN IF NOT EXISTS "workingGroupId" integer
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'FK_posts_workingGroupId'
        ) THEN
          ALTER TABLE "posts"
          ADD CONSTRAINT "FK_posts_workingGroupId"
          FOREIGN KEY ("workingGroupId")
          REFERENCES "working_groups"("id")
          ON DELETE SET NULL;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_posts_workingGroupId"
      ON "posts" ("workingGroupId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_posts_workingGroupId"
    `);

    await queryRunner.query(`
      ALTER TABLE "posts"
      DROP CONSTRAINT IF EXISTS "FK_posts_workingGroupId"
    `);

    await queryRunner.query(`
      ALTER TABLE "posts"
      DROP COLUMN IF EXISTS "workingGroupId"
    `);
  }
}
