import { Token } from './token.ts';

/**
 * string: '"' [\x00-\x7F]* '"'
 * number: ([0-9.])*
 * identifier: [a-zA-Z_+-/*=<>!&?][a-zA-Z0-9_+-/*=<>!&?]*
 * 
 * literal: string | number | 'true' | 'false' | 'nil'
 * list: '(' expr* ')'
 * 
 * bindings: '[' (identifier expr)* ']'
 * params: '[' identifier* ']'
 * 
 * if_expr:  'if' expr expr expr
 * let_expr: 'let' bindings expr
 * loop_expr: 'loop' bindings expr
 * fn_expr: 'fn' identifier? params expr
 * 
 * special_form: '(' if_expr | let_expr | loop_expr | fn_expr ')'
 * expr: literal | identifier | list | special_form
 */

export type Expr = LiteralExpr | NameExpr | ListExpr | IfExpr | LetExpr | LoopExpr | FnExpr
export type Binding = { key: Token, value: Expr };

export interface ExprVisitor<T> {
	visitLiteral: (expr: LiteralExpr) => T;
	visitName: (expr: NameExpr) => T;
	visitList: (expr: ListExpr) => T;
	// visitOp: (expr: OpExpr) => T;
	visitIf: (expr: IfExpr) => T;
	visitLet: (expr: LetExpr) => T;
	visitLoop: (expr: LoopExpr) => T;
	visitFn: (expr: FnExpr) => T;
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

/*
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
}*/

export class IfExpr {
	cond: Expr;
	true_child: Expr;
	false_child: Expr;

	constructor(cond: Expr, true_child: Expr, false_child: Expr) {
		this.cond = cond;
		this.true_child = true_child;
		this.false_child = false_child;
	}

	accept<T>(visitor: ExprVisitor<T>) {
		return visitor.visitIf(this);
	}
}

export class LetExpr {
	bindings: Binding[];
	body: Expr;

	constructor(bindings: Binding[], body: Expr) {
		this.bindings = bindings;
		this.body = body;
	}

	accept<T>(visitor: ExprVisitor<T>) {
		return visitor.visitLet(this);
	}
}

export class LoopExpr {
	bindings: Binding[];
	body: Expr;

	constructor(bindings: Binding[], body: Expr) {
		this.bindings = bindings;
		this.body = body;
	}

	accept<T>(visitor: ExprVisitor<T>) {
		return visitor.visitLoop(this);
	}
}

export class FnExpr {
	name?: Token;
	params: Token[];
	body: Expr;

	constructor(params: Token[], body: Expr) {
		this.params = params;
		this.body = body;
	}

	accept<T>(visitor: ExprVisitor<T>) {
		return visitor.visitFn(this);
	}
}
