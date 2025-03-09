import { Expr, LiteralExpr, NameExpr, ListExpr, IfExpr, LetExpr } from './expr.ts';
import { Token, TokenType } from './token.ts';

export function parse_literal(tokens: Token[]) {
	const token = tokens[0];

	const expr = (() => {
		switch (token.type) {
			case TokenType.STRING:
			case TokenType.NUMBER:
				return new LiteralExpr(token.literal);
			case TokenType.TRUE:
				return new LiteralExpr(true);
			case TokenType.FALSE:
				return new LiteralExpr(false);
			case TokenType.NIL:
				return new LiteralExpr(null);
			default:
				throw new Error(`Expected literal, got ${token.type} (${token.lexeme})`);
		}
	})();

	return { expr, rest: tokens.slice(1) };
}

export function parse_name(tokens: Token[]) {
	const token = tokens[0];

	return { expr: new NameExpr(token.lexeme), rest: tokens.slice(1) };
}

export function parse_list(tokens: Token[]) {
	let rest = tokens.slice(1);
	const children: Expr[] = [];

	while (rest[0].type !== TokenType.R_PAREN) {
		const { expr, rest: new_rest } = parse_expr(rest);
		children.push(expr);

		if (new_rest.length === 0)
			throw new Error(`Expected R_PAREN at end of list, reached end of input`);

		rest = new_rest;
	}

	// Chop off closing parenthesis.
	return { expr: new ListExpr(children), rest: rest.slice(1) };
}

export function parse_bindings(tokens: Token[]) {
	let rest = tokens.slice(1);
	const bindings: { key: Token, value: Expr }[] = [];

	while (rest[0].type !== TokenType.R_SQUARE) {
		const name = rest[0];

		if (rest.length === 1)
			throw new Error(`Unterminated bindings, reached end of input`);

		const { expr, rest: new_rest } = parse_expr(rest.slice(1));
		bindings.push({ key: name, value: expr });

		if (new_rest.length === 0)
			throw new Error(`Expected R_SQUARE at end of bindings, reached end of input`);

		rest = new_rest;
	}

	// Chop off closing bracket.
	return { bindings, rest: rest.slice(1) };
}

/*
export function parse_op(tokens: Token[]) {
	if (tokens.length < 2)
		throw new Error(`Unterminated op expression, got "${tokens.map(t => t.lexeme).join(' ')}" before end of input`);

	const op = tokens[0];
	let rest = tokens.slice(1);
	const children: Expr[] = [];

	while (rest[0].type !== TokenType.R_PAREN) {
		const { expr, rest: new_rest } = parse_expr(rest);
		children.push(expr);

		if (new_rest.length === 0)
			throw new Error(`Expected R_PAREN at end of list, reached end of input`);

		rest = new_rest;
	}

	return { expr: new OpExpr(op, children), rest };
}*/

// if_expr:  'if' expr expr expr
export function parse_if(tokens: Token[]) {
	if (tokens.length < 3)
		throw new Error(`Unterminated if expression, got "${tokens.map(t => t.lexeme).join(' ')}" before end of input`);

	// '(', if' are the first two tokens.
	const { expr: cond, rest: c_rest } = parse_expr(tokens.slice(2));

	if (c_rest.length === 0)
		throw new Error(`Unterminated if expression, only parsed condition before end of input (missing true/false children)`);

	const { expr: true_child, rest: l_rest } = parse_expr(c_rest);

	if (l_rest.length === 0)
		throw new Error(`Unterminated if expression, only parsed condition and true child before end of input (missing false child)`);

	const { expr: false_child, rest } = parse_expr(l_rest);

	if (rest.length === 0)
		throw new Error(`Unterminated if expression, missing R_PAREN before end of input`);

	const r_paren = rest[0];

	if (r_paren.type !== TokenType.R_PAREN)
		throw new Error(`Expected R_PAREN at end of if expression, got ${r_paren.type} (${r_paren.lexeme})`);

	return { expr: new IfExpr(cond, true_child, false_child), rest: rest.slice(1) };
}

// let_expr: 'let' bindings expr
export function parse_let(tokens: Token[]) {
	if (tokens.length < 3)
		throw new Error(`Unterminated let expression, got "${tokens.map(t => t.lexeme).join(' ')}" before end of input`);

	// '(', let' are the first two tokens.
	const l_paren = tokens[2];

	if (l_paren.type !== TokenType.L_SQUARE)
		throw new Error(`Expected L_SQUARE for bindings in let expression, got ${l_paren.type} (${l_paren.lexeme})`);

	const { bindings, rest: b_rest } = parse_bindings(tokens.slice(2));

	if (b_rest.length === 0)
		throw new Error(`Unterminated let expression, only parsed bindings before end of input (missing body)`);

	const { expr: body, rest } = parse_expr(b_rest);

	if (rest.length === 0)
		throw new Error(`Unterminated let expression, missing R_PAREN before end of input`);

	const r_paren = rest[0];

	if (r_paren.type !== TokenType.R_PAREN)
		throw new Error(`Expected R_PAREN at end of let expression, got ${r_paren.type} (${r_paren.lexeme})`);

	return { expr: new LetExpr(bindings, body), rest: rest.slice(1) };
}

// bindings: '[' (identifier expr)* ']'
// loop_expr: 'loop' bindings expr
export function parse_loop(tokens: Token[]) {
	// TODO
}

// params: '[' identifier* ']'
// fn_expr: 'fn' identifier? params expr
export function parse_fn(tokens: Token[]) {
	// TODO
}

export function parse_expr(tokens: Token[]): { expr: Expr, rest: Token[] } {
	if (tokens.length === 0)
		throw new Error(`Expected expr, reached end of input`);

	const head = tokens[0];

	switch (head.type) {
		case TokenType.STRING:
		case TokenType.NUMBER:
		case TokenType.TRUE:
		case TokenType.FALSE:
		case TokenType.NIL:
			return parse_literal(tokens);

		case TokenType.IDENTIFIER:
			return parse_name(tokens);

		case TokenType.L_PAREN: {
			if (tokens.length === 1)
				throw new Error(`Dangling L_PAREN, reached end of input`);

			const lookahead = tokens[1];

			switch (lookahead.type) {
				case TokenType.IF:
					return parse_if(tokens);

				case TokenType.LET:
					return parse_let(tokens);

				case TokenType.LOOP:
					return parse_loop(tokens);

				case TokenType.FN:
					return parse_fn(tokens);

				default:
					return parse_list(tokens);
			}
		}

		default:
			throw new Error(`Expected expression of LITERAL, IDENTIFIER or starting with L_PAREN, got ${head.type} (${head.lexeme})`);
	}
}
