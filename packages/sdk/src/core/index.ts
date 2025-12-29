/**
 * Core module - Script primitives and party system
 *
 * This module provides the foundational types and utilities for building
 * multi-party contracts with flexible m-of-n configurations.
 */

// Types
export type {
	XOnlyPubKey,
	Party,
	Timelock,
	SpendingConditionType,
	HashType,
	HashCondition,
	SpendingPath,
	ScriptConfig,
	BuiltScript,
	NetworkType,
	AddressInfo,
} from "./types.js";

// Validation utilities
export {
	ScriptConfigError,
	isValidXOnlyPubKey,
	validateParty,
	validateSpendingPath,
	validateScriptConfig,
} from "./types.js";

// Script builder
export {
	ScriptBuilder,
	createMultisigPath,
	createTimelockedPath,
	createHashPreimagePath,
} from "./script-builder.js";
