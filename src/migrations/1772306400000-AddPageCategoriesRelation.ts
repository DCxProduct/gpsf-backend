import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPageCategoriesRelation1772306400000 implements MigrationInterface {
    name = 'AddPageCategoriesRelation1772306400000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
          CREATE TABLE IF NOT EXISTS "page_categories" (
            "categoryId" integer NOT NULL,
            "pageId" integer NOT NULL,
            CONSTRAINT "PK_8b6b0cb071da4fc0ce86eb8d5ca" PRIMARY KEY ("categoryId", "pageId")
          )
        `);

        await queryRunner.query(`
          CREATE INDEX IF NOT EXISTS "IDX_page_categories_categoryId"
          ON "page_categories" ("categoryId")
        `);
        await queryRunner.query(`
          CREATE INDEX IF NOT EXISTS "IDX_page_categories_pageId"
          ON "page_categories" ("pageId")
        `);

        await queryRunner.query(`
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1
              FROM pg_constraint
              WHERE conname = 'FK_page_categories_category'
                AND conrelid = 'page_categories'::regclass
            ) THEN
              ALTER TABLE "page_categories"
              ADD CONSTRAINT "FK_page_categories_category"
              FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
            END IF;
          END $$;
        `);

        await queryRunner.query(`
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1
              FROM pg_constraint
              WHERE conname = 'FK_page_categories_page'
                AND conrelid = 'page_categories'::regclass
            ) THEN
              ALTER TABLE "page_categories"
              ADD CONSTRAINT "FK_page_categories_page"
              FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
            END IF;
          END $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "page_categories" DROP CONSTRAINT IF EXISTS "FK_page_categories_page"`);
        await queryRunner.query(`ALTER TABLE "page_categories" DROP CONSTRAINT IF EXISTS "FK_page_categories_category"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_page_categories_pageId"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_page_categories_categoryId"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "page_categories"`);
    }
}
