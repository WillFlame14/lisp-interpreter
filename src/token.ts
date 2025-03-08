export enum TokenType {
	// characters
	L_PAREN = 'L_PAREN', R_PAREN = 'R_PAREN', L_SQUARE = 'L_SQUARE', R_SQUARE = 'R_SQUARE',

	// operators
	PLUS = 'PLUS', MINUS = 'MINUS', STAR = 'STAR', SLASH = 'SLASH', EQ = 'EQ', GT = 'GT', LT = 'LT', AND = 'AND', OR = 'OR', NOT = 'NOT',

	// literals
	IDENTIFIER = 'IDENTIFIER', STRING = 'STRING', NUMBER = 'NUMBER', TRUE = 'TRUE', FALSE = 'FALSE', NIL = 'NIL',

	// keywords
	IF = 'IF', FN = 'FN', LET = 'LET', LOOP = 'LOOP'
}

export interface Token {
	type: TokenType;
	lexeme: string;
	literal: unknown;
	line: number;
}
