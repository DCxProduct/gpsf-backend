import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangePostContentToJson1761000000000 implements MigrationInterface {
  name = 'ChangePostContentToJson1761000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "posts" ALTER COLUMN "content" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "posts"
        ALTER COLUMN "content" TYPE jsonb
        USING CASE
          WHEN "content" IS NULL OR "content" = '' THEN NULL
          ELSE to_jsonb("content")
        END`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "posts"
        ALTER COLUMN "content" TYPE text
        USING CASE
          WHEN "content" IS NULL THEN NULL
          ELSE "content"::text
        END`
    );
    await queryRunner.query(`ALTER TABLE "posts" ALTER COLUMN "content" SET DEFAULT ''`);
  }
}
