import {
  Card,
  Rating as FsrsRating,
  State as FsrsState,
  createEmptyCard,
} from 'ts-fsrs';
import { FSRSState, Rating } from '../../database/enums';
import { CardProgress } from './entities/card-progress.entity';

/**
 * Bidirectional maps between this app's string enums (used in the DB/GraphQL
 * schema, chosen before ts-fsrs was picked) and ts-fsrs's own numeric enums.
 * Order matches 1:1 (NEW/LEARNING/REVIEW/RELEARNING <-> 0/1/2/3), so these
 * are simple lookup tables, not real conversion logic.
 */
const STATE_TO_FSRS: Record<FSRSState, FsrsState> = {
  [FSRSState.NEW]: FsrsState.New,
  [FSRSState.LEARNING]: FsrsState.Learning,
  [FSRSState.REVIEW]: FsrsState.Review,
  [FSRSState.RELEARNING]: FsrsState.Relearning,
};

const FSRS_TO_STATE: Record<FsrsState, FSRSState> = {
  [FsrsState.New]: FSRSState.NEW,
  [FsrsState.Learning]: FSRSState.LEARNING,
  [FsrsState.Review]: FSRSState.REVIEW,
  [FsrsState.Relearning]: FSRSState.RELEARNING,
};

const RATING_TO_GRADE: Record<
  Rating,
  Exclude<FsrsRating, FsrsRating.Manual>
> = {
  [Rating.AGAIN]: FsrsRating.Again,
  [Rating.HARD]: FsrsRating.Hard,
  [Rating.GOOD]: FsrsRating.Good,
  [Rating.EASY]: FsrsRating.Easy,
};

export function ratingToGrade(rating: Rating) {
  return RATING_TO_GRADE[rating];
}

/** A never-studied card has no `CardProgress` row yet — ts-fsrs's own empty-card shape covers that case. */
export function toFsrsCard(progress: CardProgress | null, now: Date): Card {
  if (!progress) {
    return createEmptyCard(now);
  }
  return {
    due: progress.dueAt,
    stability: progress.stability,
    difficulty: progress.difficulty,
    elapsed_days: progress.elapsedDays,
    scheduled_days: progress.scheduledDays,
    learning_steps: progress.learningSteps,
    reps: progress.reps,
    lapses: progress.lapses,
    state: STATE_TO_FSRS[progress.state],
    last_review: progress.lastReviewedAt ?? undefined,
  };
}

/** Copies a post-review ts-fsrs `Card` back onto the persisted `CardProgress` row (mutates in place). */
export function applyFsrsCard(progress: CardProgress, card: Card): void {
  progress.dueAt = card.due;
  progress.stability = card.stability;
  progress.difficulty = card.difficulty;
  progress.elapsedDays = card.elapsed_days;
  progress.scheduledDays = card.scheduled_days;
  progress.learningSteps = card.learning_steps;
  progress.reps = card.reps;
  progress.lapses = card.lapses;
  progress.state = FSRS_TO_STATE[card.state];
}

/**
 * Human-readable interval label for the rating preview buttons
 * (UI_UX_DESIGN.md §11.1: "AGAIN (10m) / HARD (12h) / GOOD (4d) / EASY (9d)").
 * Computed straight from the scheduled `due` timestamp rather than trusting
 * `scheduled_days` to represent sub-day intervals precisely — robust
 * regardless of how ts-fsrs internally tracks short (re)learning steps.
 */
export function formatIntervalLabel(due: Date, now: Date): string {
  const minutes = Math.round((due.getTime() - now.getTime()) / 60_000);
  if (minutes < 60) return `${Math.max(minutes, 1)}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}
