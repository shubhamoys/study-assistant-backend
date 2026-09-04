export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
  /**
   * Exclusively seeder-assigned (see database/seeds/seed.ts) — no mutation
   * ever grants or revokes this role. Can do everything an ADMIN can, plus
   * add/remove other admins (adminCreateAdminUser/adminUpdateUserRole are
   * gated to this role alone, not ADMIN).
   */
  SUPER_ADMIN = 'SUPER_ADMIN',
}

export enum Difficulty {
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED',
}

export enum Rating {
  AGAIN = 'AGAIN',
  HARD = 'HARD',
  GOOD = 'GOOD',
  EASY = 'EASY',
}

export enum FSRSState {
  NEW = 'NEW',
  LEARNING = 'LEARNING',
  REVIEW = 'REVIEW',
  RELEARNING = 'RELEARNING',
}
