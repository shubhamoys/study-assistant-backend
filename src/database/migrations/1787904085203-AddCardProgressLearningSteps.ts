import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCardProgressLearningSteps1787904085203 implements MigrationInterface {
  name = 'AddCardProgressLearningSteps1787904085203';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "card_progress" ADD "learningSteps" integer NOT NULL DEFAULT '0'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "card_progress" DROP COLUMN "learningSteps"`,
    );
  }
}
