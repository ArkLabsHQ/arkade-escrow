// Ensure Nest uses test env, and noble doesn't use insecure PRNGs.
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret";
process.env.AUTH_CHALLENGE_ORIGIN = "http://localhost:test";
