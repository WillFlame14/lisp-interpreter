import { Token } from './token.ts';

/**
 * string: '"' [\x00-\x7F]* '"'
 * number: ([0-9.])*
 * identifier: [a-zA-Z_+-/*=<>!&?][a-zA-Z0-9_+-/*=<>!&?]*
 * 
 * literal: string | number | 'true' | 'false' | 'nil'
 * 
 * bindings: '[' (identifier expr)* ']'
 * params: '[' identifier* ']'
 * 
 * s_expr: '(' expr* ')'
 * if_expr:  'if' expr expr expr
 * let_expr: 'let' bindings expr
 * loop_expr: 'loop' bindings expr
 * fn_expr: 'fn' identifier? params expr
 * 
 * special_form: '(' if_expr | let_expr | loop_expr | fn_expr ')'
 * expr: literal | identifier | s_expr | special_form
 */

export type Expr = LiteralExpr | NameExpr | SExpr | IfExpr | LetExpr | LoopExpr | FnExpr
export type Binding = { key: Token, value: Expr };

export function isExpr(obj: unknown): obj is Expr {
	return typeof (obj as Expr).accept === 'function';
}

export interface ExprVisitor<T> {
	visitLiteral: (expr: LiteralExpr) => T;
	visitName: (expr: NameExpr) => T;
	visitSExpr: (expr: SExpr) => T;
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
	name: Token;

	constructor(name: Token) {
		this.name = name;
	}

	accept<T>(visitor: ExprVisitor<T>) {
		return visitor.visitName(this);
	}
}

export class SExpr {
	children: Expr[];

	/** The closing parenthesis, used for reporting errors. */
	r_paren: Token;

	constructor(children: Expr[], r_paren: Token) {
		this.children = children;
		this.r_paren = r_paren;
	}

	accept<T>(visitor: ExprVisitor<T>) {
		return visitor.visitSExpr(this);
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

	l_paren: Token;

	constructor(params: Token[], body: Expr, l_paren: Token, name?: Token) {
		this.name = name;
		this.params = params;
		this.body = body;
		this.l_paren = l_paren;
	}

	accept<T>(visitor: ExprVisitor<T>) {
		return visitor.visitFn(this);
	}
}
