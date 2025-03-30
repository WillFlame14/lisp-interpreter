import { Token } from './token.ts';
import { LValBoolean, LValNil, LValNumber, LValString } from './types.ts';

/**
 * string: '"' [\x00-\x7F]* '"'
 * number: [0-9.]+
 * symbol: [a-zA-Z_+-/*=<>!&?][a-zA-Z0-9_+-/*=<>!&?]*
 * 
 * literal: 'true' | 'false' | 'nil' | string | number | symbol
 * list: '(' primary* ')'
 * vector: '[' primary* ']'
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

export enum BaseType {
	NUMBER = 'NUMBER', STRING = 'STRING', BOOLEAN = 'BOOLEAN', NIL = 'NIL',

	SYMBOL = 'SYMBOL', LIST = 'LIST', VECTOR = 'VECTOR', ANY = 'ANY'
}

export enum ComplexType {
	FUNCTION = 'FUNCTION', OBJECT = 'OBJECT'
}

export type ExprType = { type: BaseType } |
	{
		type: ComplexType.FUNCTION,
		arity: number,
		params: ExprType[],
		params_rest?: ExprType,
		return_type: ExprType
	};

export interface IExpr {
	captured_symbols: Set<string>;
	return_type: ExprType;
	toString: () => string;
}

export type Expr = PrimaryExpr | SExpr | IfExpr | LetExpr | LoopExpr | RecurExpr | DoExpr;
export type PrimaryExpr = LiteralExpr | ListExpr | VectorExpr;
export type Binding = { key: Token, value: Expr };

export type LiteralExpr = LValNumber | LValString | LValBoolean | SymbolExpr | LValNil | FnExpr;

export class SymbolExpr implements IExpr {
	name: Token;
	captured_symbols: Set<string>;
	return_type: ExprType;

	constructor(name: Token, captured_symbols: Set<string>, return_type: ExprType) {
		this.name = name;
		this.captured_symbols = captured_symbols;
		this.return_type = return_type;
	}

	toString() {
		return `(SYMBOL ${this.name.lexeme}: type ${this.return_type.type})`;
	}
}

export class ListExpr implements IExpr {
	children: Expr[];
	readonly captured_symbols = new Set<string>();
	readonly return_type = { type: BaseType.LIST };

	/** The opening parenthesis, used for reporting errors. */
	l_paren: Token;

	constructor(children: Expr[], l_paren: Token) {
		this.children = children;
		this.l_paren = l_paren;
	}

	toString(): string {
		return `(${this.children.map(c => c.toString()).join(' ')})`;
	}
}

export class VectorExpr implements IExpr {
	children: Expr[];
	readonly captured_symbols = new Set<string>();
	readonly return_type = { type: BaseType.VECTOR };

	/** The opening bracket, used for reporting errors. */
	l_square: Token;

	constructor(children: Expr[], l_paren: Token) {
		this.children = children;
		this.l_square = l_paren;
	}

	toString(): string {
		return `[${this.children.map(c => c.toString()).join(' ')}]`;
	}
}

export class FnExpr implements IExpr {
	def: boolean;
	name?: string;
	params: Token[];
	body: Expr;
	captured_symbols: Set<string>;
	return_type: ExprType;

	l_paren: Token;

	constructor(def: boolean, params: Token[], body: Expr, return_type: ExprType, captured_symbols: Set<string>, l_paren: Token, name?: string) {
		this.def = def;
		this.name = name;
		this.params = params;
		this.body = body;
		this.return_type = return_type;
		this.captured_symbols = captured_symbols;
		this.l_paren = l_paren;
	}

	toString(): string {
		return `(FUNCTION${this.name === undefined ? '' : ` ${this.name}`}: [${this.params.map(p => p.lexeme).join(' ')}] ${this.body.toString()}, captures ${Array.from(this.captured_symbols).join()}, returns ${this.return_type.type})`;
	}
}

export class SExpr implements IExpr {
	op: SymbolExpr | SExpr | FnExpr;
	children: Expr[];
	captured_symbols: Set<string>;
	return_type: ExprType;

	/** The opening parenthesis, used for reporting errors. */
	l_paren: Token;

	constructor(op: SymbolExpr | SExpr | FnExpr, children: Expr[], captured_symbols: Set<string>, return_type: ExprType, l_paren: Token) {
		this.op = op;
		this.children = children;
		this.captured_symbols = captured_symbols;
		this.return_type = return_type;
		this.l_paren = l_paren;
	}

	toString(): string {
		return `(S: ${this.op.toString()} ${this.children.map(c => c.toString()).join(' ')}, captures ${Array.from(this.captured_symbols).join()}, returns ${this.return_type.type})`;
	}
}

export class IfExpr implements IExpr {
	cond: Expr;
	true_child: Expr;
	false_child: Expr;
	captured_symbols: Set<string>;
	return_type: ExprType;

	constructor(cond: Expr, true_child: Expr, false_child: Expr, captured_symbols: Set<string>, return_type: ExprType) {
		this.cond = cond;
		this.true_child = true_child;
		this.false_child = false_child;
		this.captured_symbols = captured_symbols;
		this.return_type = return_type;
	}

	toString(): string {
		return `(IF: ${this.cond.toString()} ${this.true_child.toString()} ${this.false_child.toString()}, captures ${Array.from(this.captured_symbols).join()}, returns ${this.return_type.type})`;
	}
}

export class LetExpr implements IExpr {
	bindings: Binding[];
	body: Expr;
	captured_symbols: Set<string>;
	return_type: ExprType;

	constructor(bindings: Binding[], body: Expr, captured_symbols: Set<string>, return_type: ExprType) {
		this.bindings = bindings;
		this.body = body;
		this.captured_symbols = captured_symbols;
		this.return_type = return_type;
	}

	toString(): string {
		return `(LET: [${this.bindings.map(b => `${b.key.lexeme} ${b.value.toString()}`).join(' ')}] ${this.body.toString()}, captures ${Array.from(this.captured_symbols).join()}, returns ${this.return_type.type})`;
	}
}

export class LoopExpr implements IExpr {
	bindings: Binding[];
	body: Expr;
	captured_symbols: Set<string>;
	return_type = { type: BaseType.NIL };

	l_paren: Token;

	constructor(bindings: Binding[], body: Expr, captured_symbols: Set<string>, l_paren: Token) {
		this.bindings = bindings;
		this.body = body;
		this.captured_symbols = captured_symbols;
		this.l_paren = l_paren;
	}

	toString(): string {
		return `(loop [${this.bindings.map(b => `${b.key.lexeme} ${b.value.toString()}`)}] ${this.body.toString()})`;
	}
}

export class RecurExpr implements IExpr {
	loop_vals: Expr[];
	readonly captured_symbols = new Set<string>();
	return_type = { type: BaseType.NIL };

	l_paren: Token;

	constructor(loop_vals: Expr[], l_paren: Token) {
		this.loop_vals = loop_vals;
		this.l_paren = l_paren;
	}

	toString(): string {
		return `(recur ${this.loop_vals.map(l => l.toString()).join(' ')})`;
	}
}

// export class QuoteExpr implements IExpr {
// 	body: PrimaryExpr;
// 	readonly captured_symbols = new Set<string>();
// 	return_type: ExprType;

// 	l_paren: Token;

// 	constructor(body: PrimaryExpr, return_type: ExprType, l_paren: Token) {
// 		this.body = body;
// 		this.return_type = return_type;
// 		this.l_paren = l_paren;
// 	}

// 	toString() {
// 		return `(quote ${this.body.toString()})`;
// 	}
// }

export class DoExpr implements IExpr {
	bodies: Expr[];
	captured_symbols: Set<string>;
	return_type: ExprType;
	l_paren: Token;

	constructor(bodies: Expr[], captured_symbols: Set<string>, return_type: ExprType, l_paren: Token) {
		this.bodies = bodies;
		this.captured_symbols = captured_symbols;
		this.return_type = return_type;
		this.l_paren = l_paren;
	}

	toString(): string {
		return `(do ${this.bodies.map(b => b.toString()).join(' ')})`;
	}
}
