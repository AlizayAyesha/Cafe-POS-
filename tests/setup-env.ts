/**
 * Must run before any module imports Prisma.
 * Isolates integration (and all) tests onto prisma/test.db — never touch dev.db.
 */
process.env.DATABASE_URL = "file:./test.db";
