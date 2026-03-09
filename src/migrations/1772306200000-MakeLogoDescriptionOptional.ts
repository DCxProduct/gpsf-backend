import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeLogoDescriptionOptional1772306200000 implements MigrationInterface {
  name = 'MakeLogoDescriptionOptional1772306200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the NOT NULL rule so create/update can save logos without a description.
    await queryRunner.query(`
      ALTER TABLE "logos"
      ALTER COLUMN "description" DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Backfill empty text before restoring the old NOT NULL rule.
    await queryRunner.query(`
      UPDATE "logos"
      SET "description" = ''
      WHERE "description" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "logos"
      ALTER COLUMN "description" SET NOT NULL
    `);
  }
}
