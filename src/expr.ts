import { Token } from './token.ts';

/**
 * string: '"' [\x00-\x7F]* '"'
 * number: [0-9.]+
 * symbol: [a-zA-Z_+-/*=<>!&?][a-zA-Z0-9_+-/*=<>!&?]*
 * 
 * literal: 'true' | 'false' | 'nil' | string | number
 * list: '(' primary* ')'
 * primary: literal | symbol | list
 * 
 * bindings: '[' (symbol expr)* ']'
 * params: '[' symbol* ']'
 * 
 * s_expr: '(' expr* ')'
 * if_expr:  'if' expr expr expr
 * let_expr: 'let' bindings expr
 * loop_expr: 'loop' bindings expr
 * recur_expr: 'recur' expr*
 * fn_expr: 'fn' symbol? params expr
 * quote_expr: 'quote' primary
 * 
 * special_form: '(' if_expr | let_expr | loop_expr | fn_expr | quote_expr ')'
 * expr: literal | symbol | special_form | s_expr
 */

export type Expr = LiteralExpr | SymbolExpr | SExpr | IfExpr | LetExpr | LoopExpr | RecurExpr | FnExpr | QuoteExpr;
export type PrimaryExpr = LiteralExpr | SymbolExpr | ListExpr;
export type Binding = { key: Token, value: Expr };

export function isExpr(obj: unknown): obj is Expr {
	return typeof (obj as Expr).accept === 'function';
}

export interface ExprVisitor<T> {
	visitLiteral: (expr: LiteralExpr) => T;
	visitSymbol: (expr: SymbolExpr) => T;
	visitList: (expr: ListExpr) => T;
	visitSExpr: (expr: SExpr) => T;
	visitIf: (expr: IfExpr) => T;
	visitLet: (expr: LetExpr) => T;
	visitLoop: (expr: LoopExpr) => T;
	visitRecur: (expr: RecurExpr) => T;
	visitFn: (expr: FnExpr) => T;
	visitQuote: (expr: QuoteExpr) => T;
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

export class SymbolExpr {
	name: Token;

	constructor(name: Token) {
		this.name = name;
	}

	accept<T>(visitor: ExprVisitor<T>) {
		return visitor.visitSymbol(this);
	}
}

export class ListExpr {
	children: PrimaryExpr[];

	/** The closing parenthesis, used for reporting errors. */
	r_paren: Token;

	constructor(children: PrimaryExpr[], r_paren: Token) {
		this.children = children;
		this.r_paren = r_paren;
	}

	accept<T>(visitor: ExprVisitor<T>) {
		return visitor.visitList(this);
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
	l_paren: Token;

	constructor(bindings: Binding[], body: Expr, l_paren: Token) {
		this.bindings = bindings;
		this.body = body;
		this.l_paren = l_paren;
	}

	accept<T>(visitor: ExprVisitor<T>) {
		return visitor.visitLoop(this);
	}
}

export class RecurExpr {
	loop_vals: Expr[];
	l_paren: Token;

	constructor(loop_vals: Expr[], l_paren: Token) {
		this.loop_vals = loop_vals;
		this.l_paren = l_paren;
	}

	accept<T>(visitor: ExprVisitor<T>) {
		return visitor.visitRecur(this);
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

export class QuoteExpr {
	body: PrimaryExpr;
	l_paren: Token;

	constructor(body: PrimaryExpr, l_paren: Token) {
		this.body = body;
		this.l_paren = l_paren;
	}

	accept<T>(visitor: ExprVisitor<T>) {
		return visitor.visitQuote(this);
	}
}
