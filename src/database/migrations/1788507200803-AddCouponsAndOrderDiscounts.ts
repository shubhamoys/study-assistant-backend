import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCouponsAndOrderDiscounts1788507200803 implements MigrationInterface {
  name = 'AddCouponsAndOrderDiscounts1788507200803';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."coupons_discounttype_enum" AS ENUM('PERCENTAGE', 'FIXED_AMOUNT')`,
    );
    await queryRunner.query(
      `CREATE TABLE "coupons" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "code" character varying(30) NOT NULL, "discountType" "public"."coupons_discounttype_enum" NOT NULL, "discountValue" integer NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "expiresAt" TIMESTAMP WITH TIME ZONE, "maxRedemptions" integer, "redemptionsCount" integer NOT NULL DEFAULT '0', "minOrderAmount" integer, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_e025109230e82925843f2a14c48" UNIQUE ("code"), CONSTRAINT "PK_d7ea8864a0150183770f3e9a8cb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e025109230e82925843f2a14c4" ON "coupons"  ("code") `,
    );
    // Added nullable, backfilled from the pre-existing totalAmount (no
    // coupon existed before this migration, so subtotal == total for
    // every pre-existing row), then locked to NOT NULL — a plain ADD
    // COLUMN ... NOT NULL fails outright against any row already in the
    // table.
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "subtotalAmount" integer`,
    );
    await queryRunner.query(
      `UPDATE "orders" SET "subtotalAmount" = "totalAmount" WHERE "subtotalAmount" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ALTER COLUMN "subtotalAmount" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "discountAmount" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(`ALTER TABLE "orders" ADD "couponId" uuid`);
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "couponCode" character varying(30)`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "FK_c26db6c65929ecfeab91073e80c" FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT "FK_c26db6c65929ecfeab91073e80c"`,
    );
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "couponCode"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "couponId"`);
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN "discountAmount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN "subtotalAmount"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e025109230e82925843f2a14c4"`,
    );
    await queryRunner.query(`DROP TABLE "coupons"`);
    await queryRunner.query(`DROP TYPE "public"."coupons_discounttype_enum"`);
  }
}
