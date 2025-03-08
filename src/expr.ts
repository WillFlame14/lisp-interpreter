import { Token } from './token.ts';

/**
 * string: '"' [\x00-\x7F]* '"'
 * number: ([0-9.])*
 * op: '+' | '-' | '*' | '/' | '=' | '<' | '>' | 'and' | 'or' | 'not'
 * identifier: [A-z_][A-z0-9-_!?]*
 * 
 * literal: string | number | 'true' | 'false' | 'nil'
 * list: '(' expr* ')'
 * 
 * op_expr: op expr+
 * if_expr: 'if' expr expr
 * let_expr: 'let' list expr
 * loop_expr: 'loop' list expr
 * fn_expr: 'fn' identifier? list expr
 * 
 * expr: literal | list | '(' op_expr | if_expr | let_expr | loop_expr | fn_expr ')'
 */

export type Expr = LiteralExpr | NameExpr | ListExpr | OpExpr | IfExpr | LetExpr | LoopExpr | FnExpr

export interface ExprVisitor<T> {
	visitLiteral: (expr: LiteralExpr) => T
	visitName: (expr: NameExpr) => T,
	visitList: (expr: ListExpr) => T
	visitOp: (expr: OpExpr) => T
	visitIf: (expr: IfExpr) => T
	visitLet: (expr: LetExpr) => T
	visitLoop: (expr: LoopExpr) => T
	visitFn: (expr: FnExpr) => T
}

export class LiteralExpr {
	value: unknown;

	constructor(value: unknown) {
		this.value = value;
	}

	accept<T>(visitor: ExprVisitor<T>) {
		return visitor.visitLiteral(this);
	}
}

export class NameExpr {
	name: string;

	constructor(name: string) {
		this.name = name;
	}

	accept<T>(visitor: ExprVisitor<T>) {
		return visitor.visitName(this);
	}
}

export class ListExpr {
	children: Expr[];

	constructor(children: Expr[]) {
		this.children = children;
	}

	accept<T>(visitor: ExprVisitor<T>) {
		return visitor.visitList(this);
	}
}

export class OpExpr {
	op: Token;
	children: Expr[];

	constructor(op: Token, children: Expr[]) {
		this.op = op;
		this.children = children;
	}

	accept<T>(visitor: ExprVisitor<T>) {
		return visitor.visitOp(this);
	}
}

export class IfExpr {
	true_child: Expr;
	false_child: Expr;

	constructor(true_child: Expr, false_child: Expr) {
		this.true_child = true_child;
		this.false_child = false_child;
	}

	accept<T>(visitor: ExprVisitor<T>) {
		return visitor.visitIf(this);
	}
}

export class LetExpr {
	bindings: ListExpr;
	body: Expr;

	constructor(bindings: ListExpr, body: Expr) {
		this.bindings = bindings;
		this.body = body;
	}

	accept<T>(visitor: ExprVisitor<T>) {
		return visitor.visitLet(this);
	}
}

export class LoopExpr {
	bindings: ListExpr;
	body: Expr;

	constructor(bindings: ListExpr, body: Expr) {
		this.bindings = bindings;
		this.body = body;
	}

	accept<T>(visitor: ExprVisitor<T>) {
		return visitor.visitLoop(this);
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

	accept<T>(visitor: ExprVisitor<T>) {
		return visitor.visitFn(this);
	}
}
