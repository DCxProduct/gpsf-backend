import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddActivityLogsToRolePermissionsResourceEnum1772306100000 implements MigrationInterface {
  name = 'AddActivityLogsToRolePermissionsResourceEnum1772306100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_enum e ON t.oid = e.enumtypid
          WHERE t.typname = 'role_permissions_resource_enum'
            AND e.enumlabel = 'activity-logs'
        ) THEN
          ALTER TYPE "role_permissions_resource_enum" ADD VALUE 'activity-logs';
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "role_permissions" WHERE "resource" IN ('activity-logs');`);

    await queryRunner.query(`ALTER TYPE "role_permissions_resource_enum" RENAME TO "role_permissions_resource_enum_old";`);
    await queryRunner.query(`CREATE TYPE "role_permissions_resource_enum" AS ENUM('logo', 'categories', 'pages', 'sections', 'posts', 'working-groups', 'media', 'menu', 'users', 'roles', 'site-settings', 'testimonials');`);
    await queryRunner.query(`ALTER TABLE "role_permissions" ALTER COLUMN "resource" TYPE "role_permissions_resource_enum" USING "resource"::text::"role_permissions_resource_enum";`);
    await queryRunner.query(`DROP TYPE "role_permissions_resource_enum_old";`);
  }
}
