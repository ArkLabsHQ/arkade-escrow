module.exports = {
	preset: "ts-jest",
	moduleFileExtensions: ["js", "json", "ts"],
	rootDir: ".",
	testRegex: ".*.spec.ts$",
	transform: {
		"^.+\\.tsx?$": [
			"ts-jest",
			{
				tsconfig: "tsconfig.json",
			},
		],
		"^.+\\.jsx?$": [
			"ts-jest",
			{
				tsconfig: "tsconfig.json",
			},
		],
	},
	transformIgnorePatterns: ["node_modules/(?!@noble|nanoid|@arkade)"],
	collectCoverageFrom: ["src/**/*.ts"],
	coverageDirectory: "./coverage",
	testEnvironment: "node",
	setupFiles: ["<rootDir>/test/jest.setup.js"],
};
