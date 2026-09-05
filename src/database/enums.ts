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

export enum OrderStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentGateway {
  RAZORPAY = 'RAZORPAY',
  CASHFREE = 'CASHFREE',
  /** The Phase 4 checkpoint 2 stub — checkout completes instantly, no real gateway involved yet. See DEVELOPMENT_ROADMAP.md's Phase 4 "Deferred" note. */
  MANUAL = 'MANUAL',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

export enum CouponDiscountType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED_AMOUNT = 'FIXED_AMOUNT',
}
