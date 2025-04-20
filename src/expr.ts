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
	NUMBER = 'NUM', STRING = 'STR', BOOLEAN = 'BOOL', NIL = 'NIL',

	SYMBOL = 'SYM', LIST = 'LIST', VECTOR = 'VECTOR', ANY = 'ANY'
}

export enum ComplexType {
	FUNCTION = 'FN', OBJECT = 'OBJ', POLY = 'POLY'
}

export function satisfies(type: ExprType, expected: ExprType) {
	if (type.type === BaseType.ANY || expected.type === BaseType.ANY || type.type === ComplexType.POLY || expected.type === ComplexType.POLY)
		return true;

	return type.type === expected.type;
}

export function narrow(type: ExprType, constraint: ExprType) {
	if (!satisfies(type, constraint))
		throw new Error(`Can't narrow type ${JSON.stringify(type)} to constraint ${JSON.stringify(constraint)}`);

	if (constraint.type === BaseType.ANY)
		return type;

	return constraint;
}

export type ExprType = { type: BaseType } |
	{
		type: ComplexType.FUNCTION,
		params: ExprType[],
		params_rest?: ExprType,
		return_type: ExprType
	} |
	{
		type: ComplexType.POLY,
		sym: symbol,
		narrowable: boolean
	};

export interface IExpr {
	captured_symbols: Token[];
	return_type: ExprType;
	toString: () => string;
}

export type Expr = PrimaryExpr | SExpr | IfExpr | LetExpr | LoopExpr | RecurExpr | DoExpr;
export type PrimaryExpr = LiteralExpr | ListExpr | VectorExpr;
export type Binding = { key: Token, value: Expr };

export type LiteralExpr = LValNumber | LValString | LValBoolean | SymbolExpr | LValNil | FnExpr;

function logType(type: ExprType): string {
	if (type.type === ComplexType.FUNCTION) {
		const { params, params_rest, return_type } = type;

		const log_params = `${params.map(logType).join(', ')}${params_rest !== undefined ? ` & ${logType(params_rest)}`: ''}`;
		return `FN (${log_params}) => ${logType(return_type)}`;
	}

	if (type.type === ComplexType.POLY)
		return type.sym.description ?? '';

	return type.type;
}

export class SymbolExpr implements IExpr {
	name: Token;
	captured_symbols: Token[];
	return_type: ExprType;

	constructor(name: Token, captured_symbols: Token[], return_type: ExprType) {
		this.name = name;
		this.captured_symbols = captured_symbols;
		this.return_type = return_type;
	}

	toString() {
		return `(SYMBOL ${this.name.lexeme}: type ${logType(this.return_type)})`;
	}
}

export class ListExpr implements IExpr {
	children: Expr[];
	readonly captured_symbols: Token[] = [];
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
	children: PrimaryExpr[];
	readonly captured_symbols: Token[] = [];
	readonly return_type = { type: BaseType.VECTOR };

	/** The opening bracket, used for reporting errors. */
	l_square: Token;

	constructor(children: PrimaryExpr[], l_paren: Token) {
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
	params_rest?: Token;
	body: Expr;
	captured_symbols: Token[];
	return_type: ExprType;

	l_paren: Token;

	id = -1;

	constructor(def: boolean, params: Token[], body: Expr, return_type: ExprType, captured_symbols: Token[], l_paren: Token, optionals: { params_rest?: Token, name?: string } = {}) {
		this.def = def;
		this.name = optionals.name;
		this.params = params;
		this.params_rest = optionals.params_rest;
		this.body = body;
		this.return_type = return_type;
		this.captured_symbols = captured_symbols;
		this.l_paren = l_paren;
	}

	toString(): string {
		const name = this.name === undefined ? '' : ` ${this.name}`;
		const params = this.params.map(p => p.lexeme).join(' ');
		const captures = this.captured_symbols.length > 0 ? `, captures ${this.captured_symbols.map(s => s.lexeme).join()}` : '';
		return `(FUNCTION${name}: [${params}] ${this.body.toString()}${captures}, returns type ${logType(this.return_type)})`;
	}
}

export class SExpr implements IExpr {
	op: SymbolExpr | SExpr | FnExpr;
	children: Expr[];
	captured_symbols: Token[];
	return_type: ExprType;

	/** The opening parenthesis, used for reporting errors. */
	l_paren: Token;

	constructor(op: SymbolExpr | SExpr | FnExpr, children: Expr[], captured_symbols: Token[], return_type: ExprType, l_paren: Token) {
		this.op = op;
		this.children = children;
		this.captured_symbols = captured_symbols;
		this.return_type = return_type;
		this.l_paren = l_paren;
	}

	toString(): string {
		const captures = this.captured_symbols.length > 0 ? `, captures ${this.captured_symbols.map(s => s.lexeme).join()}` : '';
		return `(S: ${this.op.toString()} ${this.children.map(c => c.toString()).join(' ')}${captures}, returns type ${logType(this.return_type)})`;
	}
}

export class IfExpr implements IExpr {
	cond: Expr;
	true_child: Expr;
	false_child: Expr;
	captured_symbols: Token[];
	return_type: ExprType;

	constructor(cond: Expr, true_child: Expr, false_child: Expr, captured_symbols: Token[], return_type: ExprType) {
		this.cond = cond;
		this.true_child = true_child;
		this.false_child = false_child;
		this.captured_symbols = captured_symbols;
		this.return_type = return_type;
	}

	toString(): string {
		const captures = this.captured_symbols.length > 0 ? `, captures ${this.captured_symbols.map(s => s.lexeme).join()}` : '';
		return `(IF: ${this.cond.toString()} ${this.true_child.toString()} ${this.false_child.toString()}${captures}, returns type ${logType(this.return_type)})`;
	}
}

export class LetExpr implements IExpr {
	bindings: Binding[];
	body: Expr;
	captured_symbols: Token[];
	return_type: ExprType;

	constructor(bindings: Binding[], body: Expr, captured_symbols: Token[], return_type: ExprType) {
		this.bindings = bindings;
		this.body = body;
		this.captured_symbols = captured_symbols;
		this.return_type = return_type;
	}

	toString(): string {
		const bindings = this.bindings.map(b => `${b.key.lexeme} := ${b.value.toString()}`).join(', ');
		const captures = this.captured_symbols.length > 0 ? `, captures ${this.captured_symbols.map(s => s.lexeme).join()}` : '';
		return `(LET: [${bindings}] ${this.body.toString()}${captures}, returns type ${logType(this.return_type)})`;
	}
}

export class LoopExpr implements IExpr {
	bindings: Binding[];
	body: Expr;
	captured_symbols: Token[];
	return_type = { type: BaseType.NIL };

	l_paren: Token;

	constructor(bindings: Binding[], body: Expr, captured_symbols: Token[], l_paren: Token) {
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
	readonly captured_symbols: Token[] = [];
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
	captured_symbols: Token[];
	return_type: ExprType;
	l_paren: Token;

	constructor(bodies: Expr[], captured_symbols: Token[], return_type: ExprType, l_paren: Token) {
		this.bodies = bodies;
		this.captured_symbols = captured_symbols;
		this.return_type = return_type;
		this.l_paren = l_paren;
	}

	toString(): string {
		return `(do ${this.bodies.map(b => b.toString()).join(' ')})`;
	}
}
