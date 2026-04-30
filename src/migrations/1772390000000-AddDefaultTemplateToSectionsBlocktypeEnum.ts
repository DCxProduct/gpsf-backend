import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDefaultTemplateToSectionsBlocktypeEnum1772390000000 implements MigrationInterface {
  name = 'AddDefaultTemplateToSectionsBlocktypeEnum1772390000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_enum e ON t.oid = e.enumtypid
          WHERE t.typname = 'sections_blocktype_enum'
            AND e.enumlabel = 'default_template'
        ) THEN
          ALTER TYPE "public"."sections_blocktype_enum" ADD VALUE 'default_template';
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "sections"
      SET "blockType" = 'text_block'::"public"."sections_blocktype_enum"
      WHERE "blockType"::text = 'default_template';
    `);

    await queryRunner.query(`
      ALTER TYPE "public"."sections_blocktype_enum" RENAME TO "sections_blocktype_enum_old";
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."sections_blocktype_enum" AS ENUM(
        'hero_banner',
        'text_block',
        'annual_reports',
        'issues_responses',
        'wg_template',
        'stats',
        'benefits',
        'post_list',
        'working_group_co_chairs',
        'announcement'
      );
    `);

    await queryRunner.query(`
      ALTER TABLE "sections"
      ALTER COLUMN "blockType" TYPE "public"."sections_blocktype_enum"
      USING "blockType"::text::"public"."sections_blocktype_enum";
    `);

    await queryRunner.query(`
      DROP TYPE "public"."sections_blocktype_enum_old";
    `);
  }
}
