import { report } from './main.ts';
import { Token, TokenType } from './token.ts';
import { LVal, LValBoolean, LValList, LValNil, LValNumber, LValString, LValSymbol, LValVector } from './types.ts';

class ParseError extends Error {}

function error(token: Token, message: string) {
	if (token.type === TokenType.EOF)
		report(token.line, ` at end`, message);
	else
		report(token.line, ` at '${token.lexeme}'`, message);
	return new ParseError();
}

export class Parser {
	current = 0;
	tokens: Token[];

	constructor(tokens: Token[]) {
		this.tokens = tokens;
	}

	/** Returns the next token to be parsed. */
	peek() {
		return this.tokens[this.current];
	}

	/** Returns the next token to be parsed, and moves forward. */
	advance() {
		const token = this.peek();
		if (token.type !== TokenType.EOF)
			this.current++;
		return token;
	}

	/** If the next token matches, moves forward and returns it. Otherwise, throws an error. */
	consume(expected: TokenType, message: string) {
		const token = this.peek();
		if (token.type === expected)
			return this.advance();

		throw error(token, message);
	}

	get ended() {
		return this.peek().type === TokenType.EOF;
	}

	parse_literal() {
		const token = this.peek();
		let expr: LVal;

		switch (token.type) {
			case TokenType.STRING:
				expr = new LValString(token.literal as string);
				break;
			case TokenType.NUMBER:
				expr = new LValNumber(token.literal as number);
				break;
			case TokenType.TRUE:
				expr = new LValBoolean(true);
				break;
			case TokenType.FALSE:
				expr = new LValBoolean(false);
				break;
			case TokenType.NIL:
				expr = new LValNil();
				break;
			default:
				throw error(token, `Expected literal.`);
		}

		this.advance();
		return expr;
	}

	parse_symbol() {
		const token = this.advance();
		return new LValSymbol(token);
	}

	parse_seq(vector = false) {
		const delimeter = vector ? 'SQUARE' : 'PAREN';
		this.consume(TokenType[`L_${delimeter}`], `Expected L_${delimeter} at start of list.`);

		const children: LVal[] = [];

		while (this.peek().type !== TokenType[`R_${delimeter}`] && !this.ended)
			children.push(this.parse_primary());

		const r_paren = this.consume(TokenType[`R_${delimeter}`], `Expected R_${delimeter} at end of ${vector ? 'vector' : 'list'}.`);
		return vector ? new LValVector(children, r_paren) : new LValList(children, r_paren);
	}

	// primary: literal | symbol | list
	parse_primary() {
		const next = this.peek();

		if (this.ended)
			throw error(next, `Expected expr, reached end of input`);

		switch (next.type) {
			case TokenType.STRING:
			case TokenType.NUMBER:
			case TokenType.TRUE:
			case TokenType.FALSE:
			case TokenType.NIL:
				return this.parse_literal();

			case TokenType.SYMBOL:
				return this.parse_symbol();

			case TokenType.L_PAREN:
			case TokenType.L_SQUARE:
				return this.parse_seq(next.type === TokenType.L_SQUARE);

			default:
				throw error(next, `Expected primary expression.`);
		}
	}
}

export function parse(tokens: Token[]) {
	const parser = new Parser(tokens);
	try {
		const program: LVal[] = [];
		while (!parser.ended)
			program.push(parser.parse_primary());

		return program;
	}
	catch (err) {
		if (err instanceof ParseError)
			return [];
	}

	return [];
}
