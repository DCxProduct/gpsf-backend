import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateTestimonialsLocalization1769056000000 implements MigrationInterface {
  name = 'UpdateTestimonialsLocalization1769056000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('testimonials');
    if (!hasTable) {
      return;
    }

    await queryRunner.query(`ALTER TABLE "testimonials" ADD COLUMN IF NOT EXISTS "title" jsonb`);

    const quoteColumn: Array<{ data_type: string; udt_name: string }> = await queryRunner.query(`
      SELECT data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'testimonials'
        AND column_name = 'quote'
      LIMIT 1
    `);

    if (!quoteColumn.length) {
      return;
    }

    const isJsonb = quoteColumn[0].data_type === 'jsonb' || quoteColumn[0].udt_name === 'jsonb';
    if (isJsonb) {
      return;
    }

    const isJson = quoteColumn[0].data_type === 'json' || quoteColumn[0].udt_name === 'json';
    if (isJson) {
      await queryRunner.query(
        `ALTER TABLE "testimonials" ALTER COLUMN "quote" TYPE jsonb USING "quote"::jsonb`,
      );
      return;
    }

    await queryRunner.query(
      `ALTER TABLE "testimonials" ALTER COLUMN "quote" TYPE jsonb USING CASE WHEN "quote" IS NULL THEN NULL ELSE jsonb_build_object('en', "quote") END`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('testimonials');
    if (!hasTable) {
      return;
    }

    const quoteColumn: Array<{ data_type: string; udt_name: string }> = await queryRunner.query(`
      SELECT data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'testimonials'
        AND column_name = 'quote'
      LIMIT 1
    `);

    const isJsonb = quoteColumn.length
      ? quoteColumn[0].data_type === 'jsonb' || quoteColumn[0].udt_name === 'jsonb'
      : false;

    if (isJsonb) {
      await queryRunner.query(
        `ALTER TABLE "testimonials" ALTER COLUMN "quote" TYPE text USING COALESCE("quote"->>'en', "quote"::text)`,
      );
    }

    await queryRunner.query(`ALTER TABLE "testimonials" DROP COLUMN IF EXISTS "title"`);
  }
}
