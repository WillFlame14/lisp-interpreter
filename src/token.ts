export enum TokenType {
	// characters
	L_PAREN, R_PAREN, PLUS, MINUS, STAR, SLASH, EQ, GT, LT,

	// literals
	IDENTIFIER, STRING, NUMBER,

	// keywords
	IF, TRUE, FALSE, FN, NIL, PRINT,
}

export interface Token {
	type: TokenType;
	lexeme: string;
	literal: unknown;
	line: number;
}
