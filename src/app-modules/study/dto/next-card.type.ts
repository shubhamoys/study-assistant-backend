import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('RatingPreview')
export class RatingPreviewType {
  /** Human-readable next interval if this rating is chosen, e.g. "10m", "12h", "4d". */
  @Field()
  intervalLabel!: string;

  @Field()
  dueAt!: Date;
}

/**
 * The card to show next in a study session, plus a preview of what each of
 * the four possible ratings would schedule — lets the Study screen show
 * "AGAIN (10m) / HARD (12h) / GOOD (4d) / EASY (9d)" on the rating buttons
 * before the user picks one (UI_UX_DESIGN.md §11.1), without a round trip
 * per button. Computed via `FSRS.repeat()`, never persisted.
 */
@ObjectType('StudyCard')
export class NextCardType {
  @Field(() => ID)
  cardId!: string;

  @Field()
  front!: string;

  @Field()
  back!: string;

  @Field(() => RatingPreviewType)
  again!: RatingPreviewType;

  @Field(() => RatingPreviewType)
  hard!: RatingPreviewType;

  @Field(() => RatingPreviewType)
  good!: RatingPreviewType;

  @Field(() => RatingPreviewType)
  easy!: RatingPreviewType;
}
