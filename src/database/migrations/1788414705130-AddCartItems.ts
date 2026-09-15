import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCartItems1788414705130 implements MigrationInterface {
  name = 'AddCartItems1788414705130';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "cart_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "deckId" uuid NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_84106a3a0a3fafb0a5645b14614" UNIQUE ("userId", "deckId"), CONSTRAINT "PK_6fccf5ec03c172d27a28a82928b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_84e765378a5f03ad9900df3a9b" ON "cart_items"  ("userId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "cart_items" ADD CONSTRAINT "FK_84e765378a5f03ad9900df3a9ba" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "cart_items" ADD CONSTRAINT "FK_c8b813af1a516fbecffbaa01bbd" FOREIGN KEY ("deckId") REFERENCES "decks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "cart_items" DROP CONSTRAINT "FK_c8b813af1a516fbecffbaa01bbd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cart_items" DROP CONSTRAINT "FK_84e765378a5f03ad9900df3a9ba"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_84e765378a5f03ad9900df3a9b"`,
    );
    await queryRunner.query(`DROP TABLE "cart_items"`);
  }
}
