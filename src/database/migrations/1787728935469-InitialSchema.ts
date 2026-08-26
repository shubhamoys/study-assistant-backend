import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1787728935469 implements MigrationInterface {
  name = 'InitialSchema1787728935469';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "categories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(100) NOT NULL, "slug" character varying(100) NOT NULL, "description" text, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_8b0be371d28245da6e4f4b61878" UNIQUE ("name"), CONSTRAINT "UQ_420d9f679d41281f282f5bc7d09" UNIQUE ("slug"), CONSTRAINT "PK_24dbc6126a28ff948da33e97d3b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_420d9f679d41281f282f5bc7d0" ON "categories"  ("slug") `,
    );
    await queryRunner.query(
      `CREATE TABLE "refresh_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "token" character varying(512) NOT NULL, "userId" uuid NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "revokedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_4542dd2f38a61354a040ba9fd57" UNIQUE ("token"), CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_610102b60fea1455310ccd299d" ON "refresh_tokens"  ("userId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "reviews" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "deckId" uuid NOT NULL, "rating" integer NOT NULL, "comment" text, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_c5f8cb59580e17684df6c287573" UNIQUE ("userId", "deckId"), CONSTRAINT "CHK_1b5afea0550a0992b7cca3da6d" CHECK ("rating" >= 1 AND "rating" <= 5), CONSTRAINT "PK_231ae565c273ee700b283f15c1d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_df090f23b883a544d698cecfda" ON "reviews"  ("deckId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "study_sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "deckId" uuid NOT NULL, "startedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "endedAt" TIMESTAMP WITH TIME ZONE, "cardsReviewed" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_529b2be328c0a953f9bf0cf988e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_eba7be35966672a1649bc7f2c4" ON "study_sessions"  ("userId", "deckId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."review_history_rating_enum" AS ENUM('AGAIN', 'HARD', 'GOOD', 'EASY')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."review_history_state_enum" AS ENUM('NEW', 'LEARNING', 'REVIEW', 'RELEARNING')`,
    );
    await queryRunner.query(
      `CREATE TABLE "review_history" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "cardId" uuid NOT NULL, "sessionId" uuid, "rating" "public"."review_history_rating_enum" NOT NULL, "state" "public"."review_history_state_enum" NOT NULL, "stability" double precision NOT NULL, "difficulty" double precision NOT NULL, "elapsedDays" integer NOT NULL, "scheduledDays" integer NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_51873d2f958c4860b4292e980a7" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6715b910ad85aa3d5e538703f0" ON "review_history"  ("sessionId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_da02097c1a554ec13eeb272dc9" ON "review_history"  ("createdAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_881722750f588cecf1e2300258" ON "review_history"  ("userId", "cardId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum" AS ENUM('USER', 'ADMIN')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying(255) NOT NULL, "passwordHash" character varying(255) NOT NULL, "role" "public"."users_role_enum" NOT NULL DEFAULT 'USER', "isEmailVerified" boolean NOT NULL DEFAULT false, "displayName" character varying(100), "avatarUrl" character varying(512), "verificationToken" character varying(255), "resetPasswordToken" character varying(255), "resetPasswordExpires" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users"  ("email") `,
    );
    await queryRunner.query(
      `CREATE TABLE "library" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "deckId" uuid NOT NULL, "lastStudiedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_7c9c192c3f6e346d0c8e46924dd" UNIQUE ("userId", "deckId"), CONSTRAINT "PK_3a61ae2e897d9b5a59a64e91aa4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_60959da3c7fbc7f148fcbcbc9e" ON "library"  ("userId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."decks_difficulty_enum" AS ENUM('BEGINNER', 'INTERMEDIATE', 'ADVANCED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "decks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying(255) NOT NULL, "description" text, "coverUrl" character varying(512), "isPublic" boolean NOT NULL DEFAULT false, "difficulty" "public"."decks_difficulty_enum" NOT NULL DEFAULT 'BEGINNER', "isFree" boolean NOT NULL DEFAULT true, "price" integer NOT NULL DEFAULT '0', "authorId" uuid NOT NULL, "categoryId" uuid NOT NULL, "downloadsCount" integer NOT NULL DEFAULT '0', "ratingAverage" double precision NOT NULL DEFAULT '0', "ratingCount" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_981894e3f8dbe5049ac59cb1af1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5d5cb0d71adc4b7f21d50b94df" ON "decks"  ("authorId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ad6ed96911b551b33690e88278" ON "decks"  ("categoryId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6bd4953a283cf33a9819927130" ON "decks"  ("isPublic", "isFree") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."card_progress_state_enum" AS ENUM('NEW', 'LEARNING', 'REVIEW', 'RELEARNING')`,
    );
    await queryRunner.query(
      `CREATE TABLE "card_progress" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "cardId" uuid NOT NULL, "deckId" uuid NOT NULL, "state" "public"."card_progress_state_enum" NOT NULL DEFAULT 'NEW', "stability" double precision NOT NULL DEFAULT '0', "difficulty" double precision NOT NULL DEFAULT '0', "elapsedDays" integer NOT NULL DEFAULT '0', "scheduledDays" integer NOT NULL DEFAULT '0', "reps" integer NOT NULL DEFAULT '0', "lapses" integer NOT NULL DEFAULT '0', "lastReviewedAt" TIMESTAMP WITH TIME ZONE, "dueAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_af5ba8e3170622562cfd9d80cac" UNIQUE ("userId", "cardId"), CONSTRAINT "PK_e3321b0d3e1ca58d98b658700a1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_88d803d03b2a9062f295ba193a" ON "card_progress"  ("userId", "deckId", "dueAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5df820a1187f186236b0065ef9" ON "card_progress"  ("userId", "dueAt") `,
    );
    await queryRunner.query(
      `CREATE TABLE "flashcards" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "deckId" uuid NOT NULL, "front" text NOT NULL, "back" text NOT NULL, "orderIndex" integer NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_9acf891ec7aaa7ca05c264ea94d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3a8fb45d6c8da92b5c3e2e390c" ON "flashcards"  ("deckId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_47bb96e17c75683d245fbf5d26" ON "flashcards"  ("deckId", "orderIndex") `,
    );
    await queryRunner.query(
      `CREATE TABLE "attachments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "flashcardId" uuid, "url" character varying(512) NOT NULL, "fileName" character varying(255) NOT NULL, "fileSize" integer NOT NULL, "mimeType" character varying(100) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_5e1f050bcff31e3084a1d662412" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_35138b11d46d53c48ed932afa4" ON "attachments"  ("userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_dc2f90d4cd1328421e99bf2618" ON "attachments"  ("flashcardId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_610102b60fea1455310ccd299de" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" ADD CONSTRAINT "FK_7ed5659e7139fc8bc039198cc1f" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" ADD CONSTRAINT "FK_df090f23b883a544d698cecfda7" FOREIGN KEY ("deckId") REFERENCES "decks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "study_sessions" ADD CONSTRAINT "FK_628d776d2b474accdb28fa8bdba" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "study_sessions" ADD CONSTRAINT "FK_9d6b8e9a778cca5c820d7ecd38c" FOREIGN KEY ("deckId") REFERENCES "decks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "review_history" ADD CONSTRAINT "FK_136b7df85e6e5b3606b486dd849" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "review_history" ADD CONSTRAINT "FK_1878ad82636e8dd804488f4aa8f" FOREIGN KEY ("cardId") REFERENCES "flashcards"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "review_history" ADD CONSTRAINT "FK_6715b910ad85aa3d5e538703f03" FOREIGN KEY ("sessionId") REFERENCES "study_sessions"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "library" ADD CONSTRAINT "FK_60959da3c7fbc7f148fcbcbc9ea" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "library" ADD CONSTRAINT "FK_22d7a064075dc8ff8ebe9e7988c" FOREIGN KEY ("deckId") REFERENCES "decks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "decks" ADD CONSTRAINT "FK_5d5cb0d71adc4b7f21d50b94df9" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "decks" ADD CONSTRAINT "FK_ad6ed96911b551b33690e88278d" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_progress" ADD CONSTRAINT "FK_e1b1c2112e649f76a203411a01b" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_progress" ADD CONSTRAINT "FK_2fe14b8f72c51d947050a70dd82" FOREIGN KEY ("cardId") REFERENCES "flashcards"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_progress" ADD CONSTRAINT "FK_3ed587288784d2135b1ceda0eba" FOREIGN KEY ("deckId") REFERENCES "decks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "flashcards" ADD CONSTRAINT "FK_3a8fb45d6c8da92b5c3e2e390c3" FOREIGN KEY ("deckId") REFERENCES "decks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "attachments" ADD CONSTRAINT "FK_35138b11d46d53c48ed932afa47" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "attachments" ADD CONSTRAINT "FK_dc2f90d4cd1328421e99bf2618f" FOREIGN KEY ("flashcardId") REFERENCES "flashcards"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "attachments" DROP CONSTRAINT "FK_dc2f90d4cd1328421e99bf2618f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attachments" DROP CONSTRAINT "FK_35138b11d46d53c48ed932afa47"`,
    );
    await queryRunner.query(
      `ALTER TABLE "flashcards" DROP CONSTRAINT "FK_3a8fb45d6c8da92b5c3e2e390c3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_progress" DROP CONSTRAINT "FK_3ed587288784d2135b1ceda0eba"`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_progress" DROP CONSTRAINT "FK_2fe14b8f72c51d947050a70dd82"`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_progress" DROP CONSTRAINT "FK_e1b1c2112e649f76a203411a01b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "decks" DROP CONSTRAINT "FK_ad6ed96911b551b33690e88278d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "decks" DROP CONSTRAINT "FK_5d5cb0d71adc4b7f21d50b94df9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "library" DROP CONSTRAINT "FK_22d7a064075dc8ff8ebe9e7988c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "library" DROP CONSTRAINT "FK_60959da3c7fbc7f148fcbcbc9ea"`,
    );
    await queryRunner.query(
      `ALTER TABLE "review_history" DROP CONSTRAINT "FK_6715b910ad85aa3d5e538703f03"`,
    );
    await queryRunner.query(
      `ALTER TABLE "review_history" DROP CONSTRAINT "FK_1878ad82636e8dd804488f4aa8f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "review_history" DROP CONSTRAINT "FK_136b7df85e6e5b3606b486dd849"`,
    );
    await queryRunner.query(
      `ALTER TABLE "study_sessions" DROP CONSTRAINT "FK_9d6b8e9a778cca5c820d7ecd38c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "study_sessions" DROP CONSTRAINT "FK_628d776d2b474accdb28fa8bdba"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" DROP CONSTRAINT "FK_df090f23b883a544d698cecfda7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" DROP CONSTRAINT "FK_7ed5659e7139fc8bc039198cc1f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_610102b60fea1455310ccd299de"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_dc2f90d4cd1328421e99bf2618"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_35138b11d46d53c48ed932afa4"`,
    );
    await queryRunner.query(`DROP TABLE "attachments"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_47bb96e17c75683d245fbf5d26"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3a8fb45d6c8da92b5c3e2e390c"`,
    );
    await queryRunner.query(`DROP TABLE "flashcards"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5df820a1187f186236b0065ef9"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_88d803d03b2a9062f295ba193a"`,
    );
    await queryRunner.query(`DROP TABLE "card_progress"`);
    await queryRunner.query(`DROP TYPE "public"."card_progress_state_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6bd4953a283cf33a9819927130"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ad6ed96911b551b33690e88278"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5d5cb0d71adc4b7f21d50b94df"`,
    );
    await queryRunner.query(`DROP TABLE "decks"`);
    await queryRunner.query(`DROP TYPE "public"."decks_difficulty_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_60959da3c7fbc7f148fcbcbc9e"`,
    );
    await queryRunner.query(`DROP TABLE "library"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`,
    );
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_881722750f588cecf1e2300258"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_da02097c1a554ec13eeb272dc9"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6715b910ad85aa3d5e538703f0"`,
    );
    await queryRunner.query(`DROP TABLE "review_history"`);
    await queryRunner.query(`DROP TYPE "public"."review_history_state_enum"`);
    await queryRunner.query(`DROP TYPE "public"."review_history_rating_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_eba7be35966672a1649bc7f2c4"`,
    );
    await queryRunner.query(`DROP TABLE "study_sessions"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_df090f23b883a544d698cecfda"`,
    );
    await queryRunner.query(`DROP TABLE "reviews"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_610102b60fea1455310ccd299d"`,
    );
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_420d9f679d41281f282f5bc7d0"`,
    );
    await queryRunner.query(`DROP TABLE "categories"`);
  }
}
