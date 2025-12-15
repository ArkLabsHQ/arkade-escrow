module.exports = {
	preset: "ts-jest",
	rootDir: ".",
	testEnvironment: "jsdom",
	testMatch: ["<rootDir>/src/**/*.spec.(ts|tsx)"],
	moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],

	transform: {
		"^.+\\.(ts|tsx)$": [
			"ts-jest",
			{
				tsconfig: "<rootDir>/tsconfig.json",
				useESM: true,
			},
		],
	},

	moduleNameMapper: {
		"^@/(.*)$": "<rootDir>/src/$1",
	},

	transformIgnorePatterns: [
		"node_modules/(?!(@noble|nanoid|@arkade|@scure|micro-packed|@tanstack)/)",
	],

	collectCoverageFrom: ["src/**/*.{ts,tsx}"],
	coverageDirectory: "./coverage",

	// If you need any global setup for client tests, add it here.
	// setupFilesAfterEnv: ["<rootDir>/src/test/setupTests.ts"],
};
