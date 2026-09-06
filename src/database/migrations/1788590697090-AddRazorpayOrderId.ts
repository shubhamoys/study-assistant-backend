import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRazorpayOrderId1788590697090 implements MigrationInterface {
  name = 'AddRazorpayOrderId1788590697090';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "razorpayOrderId" character varying(64)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_68aa3ea03175630b6337a2e3df" ON "orders"  ("razorpayOrderId") WHERE "razorpayOrderId" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_68aa3ea03175630b6337a2e3df"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN "razorpayOrderId"`,
    );
  }
}
