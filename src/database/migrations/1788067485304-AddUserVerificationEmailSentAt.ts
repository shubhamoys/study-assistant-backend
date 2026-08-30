import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserVerificationEmailSentAt1788067485304 implements MigrationInterface {
  name = 'AddUserVerificationEmailSentAt1788067485304';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "verificationEmailSentAt" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "verificationEmailSentAt"`,
    );
  }
}
