import { astPrinter } from './ast.ts';
import { Environment } from './environment.ts';
import { Expr, ExprVisitor, LiteralExpr, SymbolExpr, SExpr, IfExpr, LetExpr, LoopExpr, FnExpr, isExpr, QuoteExpr, ListExpr, PrimaryExpr, RecurExpr } from './expr.ts';
import { runtimeError } from './main.ts';
import { native_funcs } from './native.ts';
import { Token } from './token.ts';
import { LVal, LValBoolean, LValFunction, LValList, LValNil, LValNumber, LValString, LValSymbol, LValType } from './types.ts';

export class RuntimeError extends Error {
	token: Token;

	constructor(token: Token, message: string) {
		super(message);
		this.token = token;
	}
}

export function truthy (lval: LVal) {
	return !((lval.type === LValType.BOOLEAN && !lval.value) || lval.type === LValType.NIL);
}

export class Callable {
	arity: number;
	params: LValType[];
	params_rest: LValType[];
	call: (interpreter: Interpreter, args: LVal[], token: Token) => LVal;
	toString: string;

	constructor(arity: number, params: LValType[], params_rest: LValType[], call: (interpreter: Interpreter, args: LVal[], token: Token) => LVal, toString: string) {
		this.arity = arity;
		this.params = params;
		this.params_rest = params_rest;
		this.call = call;
		this.toString = toString;
	}
}

export class Interpreter implements ExprVisitor<LVal> {
	globals = new Environment();
	env = this.globals;

	constructor() {
		for (const { name, arity, params, params_rest, call } of native_funcs)
			this.globals.define(name, new LValFunction(new Callable(arity, params, params_rest, call, '<native fn>'), name));
	}

	evaluate(expr: Expr): LVal {
		return expr.accept(this);
	}

	visitLiteral(expr: LiteralExpr) {
		if (typeof expr.value === 'string')
			return new LValString(expr.value);

		if (typeof expr.value === 'number')
			return new LValNumber(expr.value);

		if (typeof expr.value === 'boolean')
			return new LValBoolean(expr.value);

		if (expr.value === null)
			return new LValNil();

		throw new Error(`Visited literal ${JSON.stringify(expr)} but couldn't interpret it!`);
	}

	visitSymbol(expr: SymbolExpr) {
		const value = this.env.retrieve(expr.name);

		return isExpr(value) ? this.evaluate(value) : value;
	}

	visitPrimary(expr: PrimaryExpr) {
		if (expr instanceof LiteralExpr)
			return this.visitLiteral(expr);

		if (expr instanceof SymbolExpr)
			return new LValSymbol(expr.name.lexeme);

		return this.visitList(expr);
	}

	visitList(expr: ListExpr): LValList {
		return new LValList(expr.children.map(child => this.visitPrimary(child)));
	}

	visitSExpr(expr: SExpr) {
		if (expr.children.length === 0)
			throw new RuntimeError(expr.r_paren, 'Empty s-expression!');

		const func = this.evaluate(expr.children[0]);

		if (!(func instanceof LValFunction))
			throw new RuntimeError(expr.r_paren, `Unable to convert ${JSON.stringify(func)} to a function.`);

		const { arity, params, params_rest } = func.value;

		const expected_arity = arity === -1 ? expr.children.length - 1 : func.value.arity;

		if (expected_arity !== expr.children.length - 1)
			throw new RuntimeError(expr.r_paren, `Function requires ${expected_arity} parameters, got ${expr.children.length - 1}.`);

		const args = expr.children.slice(1).map(child => this.evaluate(child));

		if (params.length > 0) {
			for (let i = 0; i < args.length; i++) {
				const arg = args[i];
				const expected_type = params[i] ?? params_rest[(i - params.length) % params_rest.length];

				if (expected_type === LValType.ANY)
					continue;

				if (arg.type !== expected_type)
					throw new RuntimeError(expr.r_paren, `Parameter ${i + 1} to function (${JSON.stringify(expr.children[i + 1])}) doesn't match expected type ${expected_type}.`);
			}
		}

		return func.value.call(this, args, expr.r_paren);
	}

	visitIf(expr: IfExpr) {
		return truthy(this.evaluate(expr.cond)) ? this.evaluate(expr.true_child) : this.evaluate(expr.false_child);
	}

	visitLet(expr: LetExpr) {
		const enclosing = this.env;
		const nested = new Environment(enclosing);

		for (const { key, value } of expr.bindings)
			nested.define(key.lexeme, this.evaluate(value));

		try {
			this.env = nested;
			return this.evaluate(expr.body);
		}
		finally {
			this.env = enclosing;
		}
	}

	visitLoop(_expr: LoopExpr) {
		return undefined as unknown as LVal;
	}

	visitRecur(_expr: RecurExpr) {
		return undefined as unknown as LVal;
	}

	visitFn(expr: FnExpr) {
		const func = new Callable(
			expr.params.length,
			[],
			[],
			(interpreter: Interpreter, args: LVal[]) => {
				const enclosing = this.env;
				const nested = new Environment(enclosing);

				for (let i = 0; i < args.length; i++) {
					const param = expr.params[i].lexeme;
					nested.define(param, args[i]);
				}

				if (expr.name !== undefined)
					enclosing.define(expr.name.lexeme, new LValFunction(func, expr.name.lexeme));

				try {
					interpreter.env = nested;
					return interpreter.evaluate(expr.body);
				}
				finally {
					interpreter.env = enclosing;
				}
			},
			expr.body.accept(astPrinter)
		);

		return new LValFunction(func, expr.name?.lexeme);
	}

	visitQuote(expr: QuoteExpr) {
		return this.visitPrimary(expr.body);
	}
}

export function interpret(program: Expr[]) {
	const interpreter = new Interpreter();

	try {
		for (const expr of program)
			console.log(interpreter.evaluate(expr));
	}
	catch (err) {
		if (err instanceof RuntimeError)
			runtimeError(err);
	}
	return;
}
