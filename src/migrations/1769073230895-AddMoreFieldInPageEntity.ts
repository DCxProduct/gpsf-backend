import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMoreFieldInPageEntity1769073230895 implements MigrationInterface {
    name = 'AddMoreFieldInPageEntity1769073230895'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "categories" DROP CONSTRAINT IF EXISTS "FK_categories_createdBy_users"`);
        await queryRunner.query(`ALTER TABLE "post_images" DROP CONSTRAINT IF EXISTS "FK_post_images_posts"`);
        await queryRunner.query(`ALTER TABLE "posts" DROP CONSTRAINT IF EXISTS "FK_posts_author_users"`);
        await queryRunner.query(`
          DO $$
          BEGIN
            IF to_regclass('public.articles') IS NOT NULL THEN
              ALTER TABLE "articles" DROP CONSTRAINT IF EXISTS "FK_articles_author_setnull";
            END IF;
          END $$;
        `);
        await queryRunner.query(`ALTER TABLE "role_permissions" DROP CONSTRAINT IF EXISTS "FK_role_permissions_role_id_roles_int"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_menu_items_menuId"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_menu_items_parentId"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_menu_items_orderIndex"`);
        await queryRunner.query(`ALTER TABLE "role_permissions" DROP CONSTRAINT IF EXISTS "UQ_role_permissions_role_id_resource_int"`);

        const hasPagesTable = await queryRunner.hasTable('pages');

        if (hasPagesTable) {
            await queryRunner.query(`ALTER TABLE "pages" DROP COLUMN IF EXISTS "content"`);
            await queryRunner.query(`ALTER TABLE "pages" DROP COLUMN IF EXISTS "canonicalUrl"`);
            await queryRunner.query(`ALTER TABLE "pages" DROP COLUMN IF EXISTS "ogImageUrl"`);
            await queryRunner.query(`ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP NOT NULL DEFAULT now()`);

            await queryRunner.query(`
              DO $$
              BEGIN
                IF EXISTS (
                  SELECT 1
                  FROM information_schema.columns
                  WHERE table_name = 'pages' AND column_name = 'title'
                ) AND NOT EXISTS (
                  SELECT 1
                  FROM information_schema.columns
                  WHERE table_name = 'pages' AND column_name = 'title_text'
                ) THEN
                  ALTER TABLE "pages" RENAME COLUMN "title" TO "title_text";
                END IF;
              END $$;
            `);

            await queryRunner.query(`ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "title" jsonb`);
            await queryRunner.query(`
              DO $$
              BEGIN
                IF EXISTS (
                  SELECT 1
                  FROM information_schema.columns
                  WHERE table_name = 'pages' AND column_name = 'title_text'
                ) THEN
                  UPDATE "pages"
                  SET "title" = CASE
                    WHEN "title_text" IS NULL THEN jsonb_build_object('en', '')
                    ELSE jsonb_build_object('en', "title_text")
                  END;
                END IF;
              END $$;
            `);
            await queryRunner.query(`UPDATE "pages" SET "title" = jsonb_build_object('en', '') WHERE "title" IS NULL`);
            await queryRunner.query(`ALTER TABLE "pages" ALTER COLUMN "title" SET NOT NULL`);
            await queryRunner.query(`ALTER TABLE "pages" DROP COLUMN IF EXISTS "title_text"`);

            await queryRunner.query(`
              DO $$
              BEGIN
                IF EXISTS (
                  SELECT 1
                  FROM information_schema.columns
                  WHERE table_name = 'pages' AND column_name = 'metaTitle'
                ) AND NOT EXISTS (
                  SELECT 1
                  FROM information_schema.columns
                  WHERE table_name = 'pages' AND column_name = 'metaTitle_text'
                ) THEN
                  ALTER TABLE "pages" RENAME COLUMN "metaTitle" TO "metaTitle_text";
                END IF;
              END $$;
            `);
            await queryRunner.query(`ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "metaTitle" jsonb`);
            await queryRunner.query(`
              DO $$
              BEGIN
                IF EXISTS (
                  SELECT 1
                  FROM information_schema.columns
                  WHERE table_name = 'pages' AND column_name = 'metaTitle_text'
                ) THEN
                  UPDATE "pages"
                  SET "metaTitle" = CASE
                    WHEN "metaTitle_text" IS NULL THEN NULL
                    ELSE jsonb_build_object('en', "metaTitle_text")
                  END;
                END IF;
              END $$;
            `);
            await queryRunner.query(`ALTER TABLE "pages" DROP COLUMN IF EXISTS "metaTitle_text"`);

            await queryRunner.query(`
              DO $$
              BEGIN
                IF EXISTS (
                  SELECT 1
                  FROM information_schema.columns
                  WHERE table_name = 'pages' AND column_name = 'metaDescription'
                ) AND NOT EXISTS (
                  SELECT 1
                  FROM information_schema.columns
                  WHERE table_name = 'pages' AND column_name = 'metaDescription_text'
                ) THEN
                  ALTER TABLE "pages" RENAME COLUMN "metaDescription" TO "metaDescription_text";
                END IF;
              END $$;
            `);
            await queryRunner.query(`ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "metaDescription" jsonb`);
            await queryRunner.query(`
              DO $$
              BEGIN
                IF EXISTS (
                  SELECT 1
                  FROM information_schema.columns
                  WHERE table_name = 'pages' AND column_name = 'metaDescription_text'
                ) THEN
                  UPDATE "pages"
                  SET "metaDescription" = CASE
                    WHEN "metaDescription_text" IS NULL THEN NULL
                    ELSE jsonb_build_object('en', "metaDescription_text")
                  END;
                END IF;
              END $$;
            `);
            await queryRunner.query(`ALTER TABLE "pages" DROP COLUMN IF EXISTS "metaDescription_text"`);
        }

        await queryRunner.query(`
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM pg_constraint
              WHERE conname = 'UQ_77b4b60c0b4fd370107a911f637'
                AND conrelid = 'role_permissions'::regclass
            ) THEN
              ALTER TABLE "role_permissions" ADD CONSTRAINT "UQ_77b4b60c0b4fd370107a911f637" UNIQUE ("role_id", "resource");
            END IF;
          END $$;
        `);
        await queryRunner.query(`
          DO $$
          BEGIN
            IF to_regclass('public.articles') IS NOT NULL THEN
              ALTER TABLE "articles"
              ADD CONSTRAINT "FK_65d9ccc1b02f4d904e90bd76a34"
              FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
            END IF;
          EXCEPTION
            WHEN duplicate_object THEN
              NULL;
          END $$;
        `);
        await queryRunner.query(`
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM pg_constraint
              WHERE conname = 'FK_178199805b901ccd220ab7740ec'
                AND conrelid = 'role_permissions'::regclass
            ) THEN
              ALTER TABLE "role_permissions"
              ADD CONSTRAINT "FK_178199805b901ccd220ab7740ec"
              FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
            END IF;
          END $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "role_permissions" DROP CONSTRAINT "FK_178199805b901ccd220ab7740ec"`);
        await queryRunner.query(`
          DO $$
          BEGIN
            IF to_regclass('public.articles') IS NOT NULL THEN
              ALTER TABLE "articles" DROP CONSTRAINT IF EXISTS "FK_65d9ccc1b02f4d904e90bd76a34";
            END IF;
          END $$;
        `);
        await queryRunner.query(`ALTER TABLE "role_permissions" DROP CONSTRAINT "UQ_77b4b60c0b4fd370107a911f637"`);
        await queryRunner.query(`ALTER TABLE "pages" DROP COLUMN "metaDescription"`);
        await queryRunner.query(`ALTER TABLE "pages" ADD "metaDescription" character varying(500)`);
        await queryRunner.query(`ALTER TABLE "pages" DROP COLUMN "metaTitle"`);
        await queryRunner.query(`ALTER TABLE "pages" ADD "metaTitle" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "pages" DROP COLUMN "title"`);
        await queryRunner.query(`ALTER TABLE "pages" ADD "title" character varying(200) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "pages" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "pages" ADD "ogImageUrl" character varying(500)`);
        await queryRunner.query(`ALTER TABLE "pages" ADD "canonicalUrl" character varying(500)`);
        await queryRunner.query(`ALTER TABLE "pages" ADD "content" text NOT NULL`);
        await queryRunner.query(`ALTER TABLE "role_permissions" ADD CONSTRAINT "UQ_role_permissions_role_id_resource_int" UNIQUE ("resource", "role_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_menu_items_orderIndex" ON "menu_items" ("orderIndex") `);
        await queryRunner.query(`CREATE INDEX "IDX_menu_items_parentId" ON "menu_items" ("parentId") `);
        await queryRunner.query(`CREATE INDEX "IDX_menu_items_menuId" ON "menu_items" ("menuId") `);
        await queryRunner.query(`ALTER TABLE "role_permissions" ADD CONSTRAINT "FK_role_permissions_role_id_roles_int" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`
          DO $$
          BEGIN
            IF to_regclass('public.articles') IS NOT NULL THEN
              ALTER TABLE "articles"
              ADD CONSTRAINT "FK_articles_author_setnull"
              FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
            END IF;
          EXCEPTION
            WHEN duplicate_object THEN
              NULL;
          END $$;
        `);
        await queryRunner.query(`ALTER TABLE "posts" ADD CONSTRAINT "FK_posts_author_users" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "post_images" ADD CONSTRAINT "FK_post_images_posts" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "categories" ADD CONSTRAINT "FK_categories_createdBy_users" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

}
