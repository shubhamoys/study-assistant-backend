/**
 * Seeds the data Phase 1 needs to be testable end-to-end: an admin/author
 * account, a few categories, and a few public system decks with flashcards
 * ("browse seeded system decks" / "add deck to library" / "study").
 * Safe to re-run — every write is an upsert keyed on a unique field.
 *
 * Admin credentials come from env (SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD) —
 * never hardcoded. Deck/category/flashcard content below IS hardcoded
 * dummy data; that's fine, it isn't sensitive.
 */
import * as bcrypt from 'bcrypt';
import AppDataSource from '../data-source';
import { Difficulty, UserRole } from '../enums';
import { Category } from '../../app-modules/store/entities/category.entity';
import { Deck } from '../../app-modules/store/entities/deck.entity';
import { Flashcard } from '../../app-modules/study/entities/flashcard.entity';
import { Review } from '../../app-modules/reviews/entities/review.entity';
import { User } from '../../app-modules/users/entities/user.entity';

async function main() {
  const adminEmail = requireEnv('SEED_ADMIN_EMAIL');
  const adminPassword = requireEnv('SEED_ADMIN_PASSWORD');
  const reviewerPassword = requireEnv('SEED_REVIEWER_PASSWORD');

  await AppDataSource.initialize();

  const userRepository = AppDataSource.getRepository(User);
  const categoryRepository = AppDataSource.getRepository(Category);
  const deckRepository = AppDataSource.getRepository(Deck);
  const flashcardRepository = AppDataSource.getRepository(Flashcard);
  const reviewRepository = AppDataSource.getRepository(Review);

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await userRepository.upsert(
    {
      email: adminEmail,
      passwordHash,
      role: UserRole.ADMIN,
      isEmailVerified: true,
      displayName: 'Study Assistant',
    },
    ['email'],
  );
  const adminUser = await userRepository.findOneByOrFail({ email: adminEmail });

  const categoryDefinitions = [
    {
      name: 'Computer Science',
      slug: 'computer-science',
      description: 'Programming languages, data structures and algorithms.',
    },
    {
      name: 'Languages',
      slug: 'languages',
      description: 'Vocabulary and grammar for language learners.',
    },
    {
      name: 'Medicine',
      slug: 'medicine',
      description: 'Anatomy, physiology and clinical knowledge.',
    },
  ];
  await categoryRepository.upsert(categoryDefinitions, ['slug']);
  const categories = await categoryRepository.find();
  const csCategory = categories.find((c) => c.slug === 'computer-science')!;
  const languagesCategory = categories.find((c) => c.slug === 'languages')!;
  const medicineCategory = categories.find((c) => c.slug === 'medicine')!;

  const jsDeck = await seedDeck(deckRepository, flashcardRepository, {
    title: 'JavaScript Fundamentals',
    description: 'Core JavaScript concepts every web developer should know.',
    difficulty: Difficulty.BEGINNER,
    authorId: adminUser.id,
    categoryId: csCategory.id,
    cards: [
      [
        'What is a closure in JavaScript?',
        'A function that retains access to its lexical scope even when executed outside that scope.',
      ],
      [
        'What does `===` check that `==` does not?',
        'It checks type as well as value — no implicit type coercion.',
      ],
      [
        'What is the difference between `let` and `var`?',
        '`let` is block-scoped and not hoisted to a usable state; `var` is function-scoped and hoisted with an `undefined` initial value.',
      ],
      [
        'What is the event loop?',
        'The mechanism that lets JavaScript perform non-blocking I/O by offloading operations and processing their callbacks from a queue once the call stack is empty.',
      ],
      [
        'What does `Array.prototype.map` return?',
        'A new array containing the results of calling the provided function on every element of the original array.',
      ],
      [
        'What is a Promise?',
        'An object representing the eventual completion or failure of an asynchronous operation.',
      ],
      [
        'What is destructuring assignment?',
        'Syntax that unpacks values from arrays or properties from objects into distinct variables.',
      ],
      [
        'What is the purpose of `async`/`await`?',
        'Syntax sugar over Promises that lets asynchronous code read like synchronous code.',
      ],
    ],
  });

  const spanishDeck = await seedDeck(deckRepository, flashcardRepository, {
    title: 'Spanish Basics — Vocabulary',
    description: 'Everyday Spanish vocabulary for absolute beginners.',
    difficulty: Difficulty.BEGINNER,
    authorId: adminUser.id,
    categoryId: languagesCategory.id,
    cards: [
      ['Hola', 'Hello'],
      ['Gracias', 'Thank you'],
      ['Por favor', 'Please'],
      ['Buenos días', 'Good morning'],
      ['¿Cómo estás?', 'How are you?'],
      ['Adiós', 'Goodbye'],
      ['Lo siento', "I'm sorry"],
      ['¿Dónde está...?', 'Where is...?'],
    ],
  });

  const anatomyDeck = await seedDeck(deckRepository, flashcardRepository, {
    title: 'Anatomy 101',
    description: 'An introduction to the cardiovascular system.',
    difficulty: Difficulty.INTERMEDIATE,
    authorId: adminUser.id,
    categoryId: medicineCategory.id,
    cards: [
      [
        'What is the primary function of the sinoatrial (SA) node in the heart?',
        "It acts as the heart's natural pacemaker — a small cluster of specialized cells that generates the electrical impulses initiating each heartbeat.",
      ],
      [
        'What are the four chambers of the heart?',
        'Right atrium, right ventricle, left atrium, left ventricle.',
      ],
      [
        'What is the function of the atrioventricular (AV) node?',
        'It delays the electrical impulse from the SA node briefly, allowing the atria to finish contracting before the ventricles contract.',
      ],
      [
        'What is the difference between arteries and veins?',
        'Arteries carry blood away from the heart (usually oxygenated); veins carry blood back to the heart (usually deoxygenated).',
      ],
      [
        'What is cardiac output?',
        'The volume of blood the heart pumps per minute — heart rate multiplied by stroke volume.',
      ],
      [
        'What valve separates the left atrium and left ventricle?',
        'The mitral (bicuspid) valve.',
      ],
    ],
  });

  // Demo reviewers — so the Store isn't demoing an empty-ratings state.
  // Dummy display content per the seed-data rule; the password is still
  // env-sourced like the admin's, even though nothing currently needs to
  // log in as either of them.
  const reviewerPasswordHash = await bcrypt.hash(reviewerPassword, 10);
  const reviewerDefinitions = [
    { email: 'priya.demo@studyassistant.dev', displayName: 'Priya Patel' },
    { email: 'marcus.demo@studyassistant.dev', displayName: 'Marcus Chen' },
  ];
  await userRepository.upsert(
    reviewerDefinitions.map((reviewer) => ({
      ...reviewer,
      passwordHash: reviewerPasswordHash,
      role: UserRole.USER,
      isEmailVerified: true,
    })),
    ['email'],
  );
  const [priya, marcus] = await Promise.all(
    reviewerDefinitions.map((reviewer) =>
      userRepository.findOneByOrFail({ email: reviewer.email }),
    ),
  );

  const reviewDefinitions = [
    {
      userId: priya.id,
      deckId: jsDeck.id,
      rating: 5,
      comment: 'Clear and well organized — closures finally clicked for me.',
    },
    {
      userId: marcus.id,
      deckId: jsDeck.id,
      rating: 4,
      comment: 'Good refresher. Would love a few more cards on closures.',
    },
    {
      userId: priya.id,
      deckId: spanishDeck.id,
      rating: 4,
      comment: 'Solid basics deck for absolute beginners.',
    },
    {
      userId: marcus.id,
      deckId: anatomyDeck.id,
      rating: 5,
      comment: 'Great for exam prep, concise and accurate.',
    },
  ];
  await reviewRepository.upsert(reviewDefinitions, ['userId', 'deckId']);

  // Recompute each reviewed deck's aggregate rating directly, rather than
  // reusing ReviewsService (this script has no Nest DI container) — same
  // AVG/COUNT logic as ReviewsService.recomputeDeckRating.
  for (const deck of [jsDeck, spanishDeck, anatomyDeck]) {
    const { average, count } = await reviewRepository
      .createQueryBuilder('review')
      .select('AVG(review.rating)', 'average')
      .addSelect('COUNT(*)', 'count')
      .where('review.deckId = :deckId', { deckId: deck.id })
      .getRawOne<{ average: string | null; count: string }>()
      .then((raw) => ({
        average: raw?.average ? Number(raw.average) : 0,
        count: Number(raw?.count ?? 0),
      }));
    await deckRepository.update(deck.id, {
      ratingAverage: average,
      ratingCount: count,
    });
  }

  console.log('Seed complete:', {
    admin: adminUser.email,
    categories: categories.map((c) => c.slug),
    reviewers: reviewerDefinitions.map((r) => r.email),
  });

  await AppDataSource.destroy();
}

async function seedDeck(
  deckRepository: import('typeorm').Repository<Deck>,
  flashcardRepository: import('typeorm').Repository<Flashcard>,
  args: {
    title: string;
    description: string;
    difficulty: Difficulty;
    authorId: string;
    categoryId: string;
    cards: [string, string][];
  },
) {
  const existing = await deckRepository.findOneBy({
    title: args.title,
    authorId: args.authorId,
  });
  if (existing) {
    return existing;
  }

  const deck = await deckRepository.save(
    deckRepository.create({
      title: args.title,
      description: args.description,
      difficulty: args.difficulty,
      isPublic: true,
      isFree: true,
      authorId: args.authorId,
      categoryId: args.categoryId,
    }),
  );

  await flashcardRepository.save(
    args.cards.map(([front, back], index) =>
      flashcardRepository.create({
        deckId: deck.id,
        front,
        back,
        orderIndex: index,
      }),
    ),
  );

  return deck;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set — add it to .env before seeding.`);
  }
  return value;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
