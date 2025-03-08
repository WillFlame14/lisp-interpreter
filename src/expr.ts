import { Token } from './token.ts';

/**
 * string: '"' [\x00-\x7F]* '"'
 * number: ([0-9.])*
 * op: '+' | '-' | '*' | '/' | '=' | '<' | '>' | 'and' | 'or' | 'not'
 * identifier: [A-z_][A-z0-9-_!?]*
 * 
 * literal: string | number | 'true' | 'false' | 'nil'
 * list: '(' expr* ')'
 * vector: '[' expr* ']'
 * 
 * op_expr: op expr+
 * if_expr: 'if' expr expr
 * let_expr: 'let' list expr
 * loop_expr: 'loop' list expr
 * fn_expr: 'fn' identifier? list expr
 * 
 * expr: literal | list | '(' op_expr | if_expr | let_expr | loop_expr | fn_expr ')'
 */

type Expr = LiteralExpr | ListExpr | OpExpr | IfExpr | LetExpr | LoopExpr | FnExpr

export class LiteralExpr {
	value: unknown;

	constructor(value: unknown) {
		this.value = value;
	}
}

export class ListExpr {
	children: Expr[];

	constructor(children: Expr[]) {
		this.children = children;
	}
}

export class OpExpr {
	op: Token;
	children: Expr[];

	constructor(op: Token, children: Expr[]) {
		this.op = op;
		this.children = children;
	}
}

export class IfExpr {
	true_child: Expr;
	false_child: Expr;

	constructor(true_child: Expr, false_child: Expr) {
		this.true_child = true_child;
		this.false_child = false_child;
	}
}

export class LetExpr {
	bindings: ListExpr;
	body: Expr;

	constructor(bindings: ListExpr, body: Expr) {
		this.bindings = bindings;
		this.body = body;
	}
}

export class LoopExpr {
	bindings: ListExpr;
	body: Expr;

	constructor(bindings: ListExpr, body: Expr) {
		this.bindings = bindings;
		this.body = body;
	}
}

export class FnExpr {
	name?: Token;
	bindings: ListExpr;
	body: Expr;

	constructor(bindings: ListExpr, body: Expr) {
		this.bindings = bindings;
		this.body = body;
	}
}
