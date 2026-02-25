import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateTestimonialsAuthorLocalization1769056100000 implements MigrationInterface {
  name = 'UpdateTestimonialsAuthorLocalization1769056100000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('testimonials');
    if (!hasTable) {
      return;
    }

    const authorNameColumn: Array<{ data_type: string; udt_name: string }> = await queryRunner.query(`
      SELECT data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'testimonials'
        AND column_name = 'authorName'
      LIMIT 1
    `);

    const shouldConvertAuthorName = authorNameColumn.length
      && authorNameColumn[0].data_type !== 'jsonb'
      && authorNameColumn[0].udt_name !== 'jsonb';

    if (shouldConvertAuthorName) {
      const isJson = authorNameColumn[0].data_type === 'json' || authorNameColumn[0].udt_name === 'json';
      if (isJson) {
        await queryRunner.query(
          `ALTER TABLE "testimonials" ALTER COLUMN "authorName" TYPE jsonb USING "authorName"::jsonb`,
        );
      } else {
        await queryRunner.query(
          `ALTER TABLE "testimonials" ALTER COLUMN "authorName" TYPE jsonb USING CASE WHEN "authorName" IS NULL THEN NULL ELSE jsonb_build_object('en', "authorName") END`,
        );
      }
    }

    const authorRoleColumn: Array<{ data_type: string; udt_name: string }> = await queryRunner.query(`
      SELECT data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'testimonials'
        AND column_name = 'authorRole'
      LIMIT 1
    `);

    const shouldConvertAuthorRole = authorRoleColumn.length
      && authorRoleColumn[0].data_type !== 'jsonb'
      && authorRoleColumn[0].udt_name !== 'jsonb';

    if (shouldConvertAuthorRole) {
      const isJson = authorRoleColumn[0].data_type === 'json' || authorRoleColumn[0].udt_name === 'json';
      if (isJson) {
        await queryRunner.query(
          `ALTER TABLE "testimonials" ALTER COLUMN "authorRole" TYPE jsonb USING CASE WHEN "authorRole" IS NULL THEN NULL ELSE "authorRole"::jsonb END`,
        );
      } else {
        await queryRunner.query(
          `ALTER TABLE "testimonials" ALTER COLUMN "authorRole" TYPE jsonb USING CASE WHEN "authorRole" IS NULL THEN NULL ELSE jsonb_build_object('en', "authorRole") END`,
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('testimonials');
    if (!hasTable) {
      return;
    }

    const authorRoleColumn: Array<{ data_type: string; udt_name: string }> = await queryRunner.query(`
      SELECT data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'testimonials'
        AND column_name = 'authorRole'
      LIMIT 1
    `);

    const isAuthorRoleJsonb = authorRoleColumn.length
      && (authorRoleColumn[0].data_type === 'jsonb' || authorRoleColumn[0].udt_name === 'jsonb');

    if (isAuthorRoleJsonb) {
      await queryRunner.query(
        `ALTER TABLE "testimonials" ALTER COLUMN "authorRole" TYPE character varying(120) USING "authorRole"->>'en'`,
      );
    }

    const authorNameColumn: Array<{ data_type: string; udt_name: string }> = await queryRunner.query(`
      SELECT data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'testimonials'
        AND column_name = 'authorName'
      LIMIT 1
    `);

    const isAuthorNameJsonb = authorNameColumn.length
      && (authorNameColumn[0].data_type === 'jsonb' || authorNameColumn[0].udt_name === 'jsonb');

    if (isAuthorNameJsonb) {
      await queryRunner.query(
        `ALTER TABLE "testimonials" ALTER COLUMN "authorName" TYPE character varying(120) USING "authorName"->>'en'`,
      );
    }
  }
}
