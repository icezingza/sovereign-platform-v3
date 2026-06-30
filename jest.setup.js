process.env.DB_PATH = process.env.DB_PATH ?? ':memory:';
process.env.OUTBOX_POLL_INTERVAL_MS = process.env.OUTBOX_POLL_INTERVAL_MS ?? '3600000';
