import { report } from './main.ts';
import { Expr, LiteralExpr, SymbolExpr, SExpr, IfExpr, LetExpr, Binding, FnExpr, QuoteExpr, ListExpr, PrimaryExpr } from './expr.ts';
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

	parse_symbol() {
		const token = this.advance();
		return new SymbolExpr(token);
	}

	parse_list() {
		this.consume(TokenType.L_PAREN, `Expected L_PAREN at start of list.`);

		const children: PrimaryExpr[] = [];

		while (this.peek().type !== TokenType.R_PAREN && !this.ended)
			children.push(this.parse_primary());

		const r_paren = this.consume(TokenType.R_PAREN, `Expected R_PAREN at end of list.`);
		return new ListExpr(children, r_paren);
	}

	// primary: literal | symbol | list
	parse_primary() {
		switch (this.peek().type) {
			case TokenType.STRING:
			case TokenType.NUMBER:
			case TokenType.TRUE:
			case TokenType.FALSE:
			case TokenType.NIL:
				return this.parse_literal();

			case TokenType.SYMBOL:
			case TokenType.IF:
			case TokenType.LET:
			case TokenType.LOOP:
			case TokenType.FN:
			case TokenType.RECUR:
			case TokenType.QUOTE:
				return this.parse_symbol();

			case TokenType.L_PAREN:
				return this.parse_list();

			default:
				throw error(this.peek(), `Expected primary expression.`);
		}
	}

	// s_expr: '(' expr* ')'
	parse_sexpr() {
		this.consume(TokenType.L_PAREN, `Expected L_PAREN at start of s-expression.`);

		const children: Expr[] = [];

		while (this.peek().type !== TokenType.R_PAREN && !this.ended)
			children.push(this.parse_expr());

		const r_paren = this.consume(TokenType.R_PAREN, `Expected R_PAREN at end of s-expression.`);
		return new SExpr(children, r_paren);
	}

	parse_bindings() {
		this.consume(TokenType.L_SQUARE, `Expected L_SQUARE at start of bindings.`);

		const bindings: Binding[] = [];

		while (this.peek().type === TokenType.SYMBOL) {
			const name = this.advance();
			const expr = this.parse_expr();

			bindings.push({ key: name, value: expr });
		}

		this.consume(TokenType.R_SQUARE, `Expected R_SQUARE at end of bindings.`);
		return bindings;
	}

	parse_params() {
		this.consume(TokenType.L_SQUARE, `Expected L_SQUARE at start of function parameters.`);

		const params: Token[] = [];

		while (this.peek().type === TokenType.SYMBOL) {
			const token = this.advance();
			params.push(token);
		}

		this.consume(TokenType.R_SQUARE, `Expected R_SQUARE at end of function parameters.`);
		return params;
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

	// recur_expr: 'recur' expr*
	parse_recur() {
		// TODO
	}

	// fn_expr: 'fn' symbol? '[' symbol* ']' expr
	parse_fn() {
		const l_paren = this.consume(TokenType.L_PAREN, `Expected L_PAREN at start of function.`);
		this.consume(TokenType.FN, `Expected function declaration.`);

		let name: Token | undefined = undefined;

		if (this.peek().type === TokenType.SYMBOL)
			name = this.consume(TokenType.SYMBOL, `e`);

		const params = this.parse_params();
		const body = this.parse_expr();

		this.consume(TokenType.R_PAREN, `Expected R_PAREN at end of function.`);
		return new FnExpr(params, body, l_paren, name);
	}

	// quote_expr: 'quote' primary
	parse_quote() {
		const l_paren = this.consume(TokenType.L_PAREN, `Expected L_PAREN at start of quoted form.`);
		this.consume(TokenType.QUOTE, `Expected quoted form.`);

		const body = this.parse_primary();

		this.consume(TokenType.R_PAREN, `Expected R_PAREN at end of quoted form.`);
		return new QuoteExpr(body, l_paren);
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

			case TokenType.SYMBOL:
				return this.parse_symbol();

			case TokenType.L_PAREN: {
				const lookahead = this.tokens[this.current + 1];

				if (lookahead.type === TokenType.EOF)
					error(this.peek(), `Dangling L_PAREN, reached end of input`);

				switch (lookahead.type) {
					case TokenType.IF:
						return this.parse_if();

					case TokenType.LET:
						return this.parse_let();

						// case TokenType.LOOP:
						// 	return this.parse_loop();

						// case TokenType.RECUR:
						// 	return this.parse_recur();

					case TokenType.FN:
						return this.parse_fn();

					case TokenType.QUOTE:
						return this.parse_quote();

					default:
						return this.parse_sexpr();
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
