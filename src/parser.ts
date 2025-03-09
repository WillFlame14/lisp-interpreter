import { report } from './main.ts';
import { Expr, LiteralExpr, NameExpr, ListExpr, IfExpr, LetExpr, Binding } from './expr.ts';
import { Token, TokenType } from './token.ts';

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
		let expr: LiteralExpr;

		switch (token.type) {
			case TokenType.STRING:
			case TokenType.NUMBER:
				expr = new LiteralExpr(token.literal);
				break;
			case TokenType.TRUE:
				expr = new LiteralExpr(true);
				break;
			case TokenType.FALSE:
				expr = new LiteralExpr(false);
				break;
			case TokenType.NIL:
				expr = new LiteralExpr(null);
				break;
			default:
				throw error(token, `Expected literal.`);
		}

		this.advance();
		return expr;
	}

	parse_name() {
		const token = this.advance();
		return new NameExpr(token.lexeme);
	}

	parse_list() {
		this.consume(TokenType.L_PAREN, `Expected L_PAREN at start of list.`);

		const children: Expr[] = [];

		while (this.peek().type !== TokenType.R_PAREN && !this.ended)
			children.push(this.parse_expr());

		this.consume(TokenType.R_PAREN, `Expected R_PAREN at end of list.`);
		return new ListExpr(children);
	}

	parse_bindings() {
		this.consume(TokenType.L_SQUARE, `Expected L_SQUARE at start of bindings.`);

		const bindings: Binding[] = [];

		while (this.peek().type === TokenType.IDENTIFIER) {
			const name = this.advance();
			const expr = this.parse_expr();

			bindings.push({ key: name, value: expr });
		}

		this.consume(TokenType.R_SQUARE, `Expected R_SQUARE at end of bindings.`);
		return bindings;
	}

	// if_expr:  'if' expr expr expr
	parse_if() {
		this.consume(TokenType.L_PAREN, `Expected L_PAREN at start of if expression.`);
		this.consume(TokenType.IF, `Expected 'if' expression.`);

		const cond = this.parse_expr();
		const true_child = this.parse_expr();
		const false_child = this.parse_expr();

		this.consume(TokenType.R_PAREN, `Expected R_PAREN at end of if expression.`);

		return new IfExpr(cond, true_child, false_child);
	}

	// let_expr: 'let' bindings expr
	parse_let() {
		this.consume(TokenType.L_PAREN, `Expected L_PAREN at start of let expression.`);
		this.consume(TokenType.LET, `Expected 'let' expression.`);

		const bindings = this.parse_bindings();
		const body = this.parse_expr();

		this.consume(TokenType.R_PAREN, `Expected R_PAREN at end of let expression.`);

		return new LetExpr(bindings, body);
	}

	// loop_expr: 'loop' bindings expr
	parse_loop() {
		// TODO
	}

	// fn_expr: 'fn' identifier? '[' identifier* ']' expr
	parse_fn() {
		// TODO
	}

	parse_expr(): Expr {
		if (this.ended)
			throw error(this.peek(), `Expected expr, reached end of input`);

		switch (this.peek().type) {
			case TokenType.STRING:
			case TokenType.NUMBER:
			case TokenType.TRUE:
			case TokenType.FALSE:
			case TokenType.NIL:
				return this.parse_literal();

			case TokenType.IDENTIFIER:
				return this.parse_name();

			case TokenType.L_PAREN: {
				const lookahead = this.tokens[this.current + 1];

				if (lookahead.type === TokenType.EOF)
					error(this.peek(), `Dangling L_PAREN, reached end of input`);

				switch (lookahead.type) {
					case TokenType.IF:
						return this.parse_if();

					case TokenType.LET:
						return this.parse_let();

					case TokenType.LOOP:
						return this.parse_loop();

					case TokenType.FN:
						return this.parse_fn();

					default:
						return this.parse_list();
				}
			}

			default:
				throw error(this.peek(), `Expected expression.`);
		}
	}
}

export function parse(tokens: Token[]) {
	const parser = new Parser(tokens);
	try {
		const program: Expr[] = [];
		while (!parser.ended)
			program.push(parser.parse_expr());

		return program;
	}
	catch (err) {
		if (err instanceof ParseError)
			return [];
	}

	return [];
}

/*
export function parse_op(tokens: Token[]) {
	if (tokens.length < 2)
		error(`Unterminated op expression, got "${tokens.map(t => t.lexeme).join(' ')}" before end of input`);

	const op = tokens[0];
	let rest = tokens.slice(1);
	const children: Expr[] = [];

	while (rest[0].type !== TokenType.R_PAREN) {
		const { expr, rest: new_rest } = parse_expr(rest);
		children.push(expr);

		if (new_rest.length === 0)
			error(`Expected R_PAREN at end of list, reached end of input`);

		rest = new_rest;
	}

	return { expr: new OpExpr(op, children), rest };
}*/
