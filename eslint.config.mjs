import globals from "globals";
import js from "@eslint/js";
import parser from "@typescript-eslint/parser";

export default [js.configs.recommended, {
	files: ['**/*.ts'],
	languageOptions: {
		globals: globals.node,
		ecmaVersion: "latest",
		parser,
		sourceType: "module"
	},
	rules: {
		"indent": ["error", "tab", { SwitchCase: 1, ignoredNodes: ["ConditionalExpression"] }],
		"no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
		"semi": "error",
		"eol-last": "warn",
		"no-trailing-spaces": ["warn", { ignoreComments: true }],
		"prefer-const": "warn"
	}
}];
