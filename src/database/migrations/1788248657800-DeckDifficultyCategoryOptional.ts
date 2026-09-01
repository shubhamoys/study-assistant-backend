import { MigrationInterface, QueryRunner } from 'typeorm';

export class DeckDifficultyCategoryOptional1788248657800 implements MigrationInterface {
  name = 'DeckDifficultyCategoryOptional1788248657800';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "decks" DROP CONSTRAINT "FK_ad6ed96911b551b33690e88278d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "decks" ALTER COLUMN "difficulty" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "decks" ALTER COLUMN "difficulty" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "decks" ALTER COLUMN "categoryId" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "decks" ADD CONSTRAINT "FK_ad6ed96911b551b33690e88278d" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "decks" DROP CONSTRAINT "FK_ad6ed96911b551b33690e88278d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "decks" ALTER COLUMN "categoryId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "decks" ALTER COLUMN "difficulty" SET DEFAULT 'BEGINNER'`,
    );
    await queryRunner.query(
      `ALTER TABLE "decks" ALTER COLUMN "difficulty" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "decks" ADD CONSTRAINT "FK_ad6ed96911b551b33690e88278d" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }
}
