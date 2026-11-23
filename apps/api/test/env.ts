process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://postgres@localhost:5432/meddexa_test';
process.env.JWT_ACCESS_SECRET = 'test-secret-test-secret-test-secret-0123';
process.env.ENABLE_SCHEDULER = 'false';
process.env.ALLOW_DEMO_DATA = 'true';
process.env.RATE_LIMIT_PER_MINUTE = '100000';
delete process.env.REDIS_URL;
delete process.env.SMTP_URL;
process.env.THROTTLE_MULTIPLIER = '1000';
