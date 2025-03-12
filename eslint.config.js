import globals from 'globals';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import parser from '@typescript-eslint/parser';

export default tseslint.config(
	eslint.configs.recommended,
	tseslint.configs.strictTypeChecked,
	{
		languageOptions: {
			globals: globals.node,
			ecmaVersion: 'latest',
			parser,
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
			sourceType: 'module'
		},
		rules: {
			'indent': ['error', 'tab', { SwitchCase: 1, ignoredNodes: ['ConditionalExpression'] }],
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
			'semi': 'error',
			'eol-last': 'warn',
			'no-trailing-spaces': ['warn', { ignoreComments: true }],
			'prefer-const': 'warn',
			'curly': ['warn', 'multi-or-nest', 'consistent'],
			'@typescript-eslint/restrict-template-expressions': 'off'
		}
	}
);
