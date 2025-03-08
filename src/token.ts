export enum TokenType {
	// characters
	L_PAREN, R_PAREN, L_SQUARE, R_SQUARE,

	// operators
	PLUS, MINUS, STAR, SLASH, EQ, GT, LT, AND, OR, NOT,

	// literals
	IDENTIFIER, STRING, NUMBER, TRUE, FALSE, NIL,

	// keywords
	IF, FN, LET, LOOP
}

export interface Token {
	type: TokenType;
	lexeme: string;
	literal: unknown;
	line: number;
}
