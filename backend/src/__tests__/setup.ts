// Runs before every test file. Sets env vars before dotenv or app loads.
process.env.JWT_SECRET     = 'test-secret';
process.env.JWT_EXPIRES_IN = '1h';
process.env.DATABASE_URL   = ':memory:'; // never used — db is fully mocked
