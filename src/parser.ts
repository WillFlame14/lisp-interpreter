import { Expr, LiteralExpr, NameExpr, ListExpr, OpExpr, IfExpr, LetExpr } from './expr.ts';
import { Token, TokenType } from './token.ts';

/**
 * string: '"' [\x00-\x7F]* '"'
 * number: ([0-9.])*
 * op: '+' | '-' | '*' | '/' | '=' | '<' | '>' | 'and' | 'or' | 'not'
 * identifier: [A-z_][A-z0-9-_!?]*
 * 
 * literal: string | number | 'true' | 'false' | 'nil'
 * name: identifier
 * list: '(' expr* ')'
 * 
 * op_expr: op expr+
 * if_expr: 'if' expr expr
 * let_expr: 'let' list expr
 * loop_expr: 'loop' list expr
 * fn_expr: 'fn' identifier? list expr
 * 
 * expr: literal | name | list | '(' op_expr | if_expr | let_expr | loop_expr | fn_expr ')'
 */

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
}

export function parse_if(tokens: Token[]) {
	if (tokens.length < 2)
		throw new Error(`Unterminated if expression, got "${tokens.map(t => t.lexeme).join(' ')}" before end of input`);

	// 'if' is the first token.
	const { expr: true_child, rest: l_rest } = parse_expr(tokens.slice(1));

	if (l_rest.length === 0)
		throw new Error(`Unterminated if expression, only parsed true child before end of input (missing false child)`);

	const { expr: false_child, rest } = parse_expr(l_rest);

	return { expr: new IfExpr(true_child, false_child), rest: rest.slice(1) };
}

export function parse_let(tokens: Token[]) {
	if (tokens.length < 2)
		throw new Error(`Unterminated let expression, got "${tokens.map(t => t.lexeme).join(' ')}" before end of input`);

	// 'let' is the first token.
	const l_paren = tokens[1];

	if (l_paren.type !== TokenType.L_PAREN)
		throw new Error(`Expected L_PAREN for bindings in let expression, got ${l_paren.type} (${l_paren.lexeme})`);

	const { expr: bindings, rest: b_rest } = parse_list(tokens.slice(1));

	if (b_rest.length === 0)
		throw new Error(`Unterminated let expression, only parsed bindings before end of input (missing body)`);

	const { expr: body, rest } = parse_expr(b_rest);

	return { expr: new LetExpr(bindings, body), rest };
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

			const { expr, rest } = (() => {
				switch (lookahead.type) {
					case TokenType.PLUS:
					case TokenType.MINUS:
					case TokenType.STAR:
					case TokenType.SLASH:
					case TokenType.EQ:
					case TokenType.GT:
					case TokenType.LT:
					case TokenType.AND:
					case TokenType.OR:
					case TokenType.NOT:
						return parse_op(tokens.slice(1));

					case TokenType.IF:
						return parse_if(tokens.slice(1));

					case TokenType.LET:
						return parse_let(tokens.slice(1));

					default:
						throw new Error(`Expected one of binary operator, if, let, loop, or fn after L_PAREN, got ${lookahead.type} (${lookahead.lexeme})`);
				}
			})();

			if (rest.length === 0)
				throw new Error(`Unterminated expression, missing R_PAREN before end of input`);

			const r_paren = rest[0];

			if (r_paren.type !== TokenType.R_PAREN)
				throw new Error(`Expected R_PAREN at end of expression, got ${r_paren.type} (${r_paren.lexeme})`);

			// Chop off closing parenthesis.
			return { expr, rest: rest.slice(1) };
		}

		default:
			throw new Error(`Expected expression starting with LITERAL or L_PAREN, got ${head.type} (${head.lexeme})`);
	}
}
