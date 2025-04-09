import { Environment } from './environment.ts';
import { BaseType, ComplexType, DoExpr, Expr, ExprType, FnExpr, IfExpr, LetExpr, ListExpr, LoopExpr, RecurExpr, SExpr, SymbolExpr, VectorExpr } from './expr.ts';
import { runtimeError } from './main.ts';
import { native_funcs } from './native.ts';
import { Token } from './token.ts';
import { logRuntimeVal, LValBoolean, LValNil, LValNumber, LValString, LValSymbol, RuntimeVal } from './types.ts';

export class RuntimeError extends Error {
	token?: Token;

	constructor(token: Token | undefined, message: string) {
		super(message);
		this.token = token;
	}
}

export function truthy(lval: RuntimeVal) {
	return !((lval instanceof LValBoolean && !lval.value) || lval instanceof LValNil);
}

export interface Callable {
	name?: string;
	macro?: boolean;
	arity: number;
	params: ExprType[];
	params_rest?: ExprType;
	call: (inner_env: Environment<RuntimeVal>, args: RuntimeVal[], token: Token) => RuntimeVal;
	toString: () => string;
}

export function argError(op: LValSymbol, args: RuntimeVal[]) {
	return new RuntimeError(op.value, `Wrong number of args (${args.length}) passed to ${op.value.lexeme}.`);
}

function interpret_if(env: Environment<RuntimeVal>, expr: IfExpr) {
	const { cond, true_child, false_child } = expr;
	const condition = interpret_expr(env, cond);

	if (truthy(condition))
		return interpret_expr(env, true_child);

	return interpret_expr(env, false_child);
}

function interpret_fn(env: Environment<RuntimeVal>, expr: FnExpr) {
	const { def, name, params, body } = expr;

	const func: Callable = {
		arity: params.length,
		params: [],
		call: (_inner_env: Environment<RuntimeVal>, args: RuntimeVal[]) => {
			const nested = new Environment(env);

			for (let i = 0; i < args.length; i++) {
				const param = params[i].lexeme;
				nested.define(param, args[i]);
			}

			if (name !== undefined)
				nested.define(name, { type: ComplexType.FUNCTION, value: func, name });

			return interpret_expr(nested, body);
		},
		toString: body.toString
	};

	if (def)
		env.define(name!, { type: ComplexType.FUNCTION, value: func, name });

	return { type: ComplexType.FUNCTION, value: func, name } as const;
}

function interpret_let(env: Environment<RuntimeVal>, expr: LetExpr) {
	const { bindings, body } = expr;
	const nested = new Environment(env);

	for (const { key, value } of bindings) {
		const evaluated_value = interpret_expr(nested, value);
		nested.define(key.lexeme, evaluated_value);
	}

	return interpret_expr(nested, body);
}

function interpret_do(env: Environment<RuntimeVal>, expr: DoExpr) {
	const { bodies } = expr;

	if (bodies.length === 0)
		return new LValNil();

	for (let i = 0; i < bodies.length - 1; i++)
		interpret_expr(env, bodies[i]);

	return interpret_expr(env, bodies[bodies.length - 1]);
}

function interpret_s(env: Environment<RuntimeVal>, expr: SExpr) {
	const { op, children } = expr;

	const func = interpret_expr(env, op);

	if (func.type !== ComplexType.FUNCTION)
		throw new RuntimeError(expr.l_paren, `${op.toString()} is not a function.`);

	const { name, arity, params, params_rest } = func.value;
	const expected_arity = arity === -1 ? children.length : func.value.arity;

	if (expected_arity !== children.length)
		throw new RuntimeError(expr.l_paren, `Function ${name !== undefined ? name : '(anon)'} requires ${expected_arity} parameters, got ${children.length}.`);

	const evaluated_args = children.map(child => interpret_expr(env, child));

	if (params.length > 0) {
		for (let i = 0; i < evaluated_args.length; i++) {
			const arg = evaluated_args[i];
			const expected_type = params[i] ?? params_rest;

			if (expected_type.type === BaseType.ANY)
				continue;

			if (arg.type !== expected_type.type)
				throw new RuntimeError(expr.l_paren, `Parameter ${i + 1} to function (${JSON.stringify(evaluated_args[i])}) doesn't match expected type ${expected_type.type}.`);
		}
	}

	const result = func.value.call(env, evaluated_args, expr.l_paren);
	return result;
}

function interpret_loop(_env: Environment<RuntimeVal>, _expr: LoopExpr) {
	return new LValNil();
}

function interpret_recur(_env: Environment<RuntimeVal>, _expr: RecurExpr) {
	return new LValNil();
}

export function interpret_expr(env: Environment<RuntimeVal>, expr: Expr): RuntimeVal {
	if (expr instanceof LValNumber || expr instanceof LValString || expr instanceof LValBoolean || expr instanceof LValNil)
		return expr;

	if (expr instanceof SymbolExpr)
		return env.retrieve(expr.name);

	if (expr instanceof ListExpr)
		return { type: BaseType.LIST, value: expr.children.map(e => interpret_expr(env, e)) };

	if (expr instanceof VectorExpr)
		return { type: BaseType.VECTOR, value: expr.children.map(e => interpret_expr(env, e)) };

	if (expr instanceof IfExpr)
		return interpret_if(env, expr);

	if (expr instanceof FnExpr)
		return interpret_fn(env, expr);

	if (expr instanceof LetExpr)
		return interpret_let(env, expr);

	if (expr instanceof DoExpr)
		return interpret_do(env, expr);

	if (expr instanceof LoopExpr)
		return interpret_loop(env, expr);

	if (expr instanceof RecurExpr)
		return interpret_recur(env, expr);

	return interpret_s(env, expr);
}

export function interpret(program: Expr[]): string {
	const environment = new Environment<RuntimeVal>();

	for (const func of native_funcs)
		environment.define(func.name, { type: ComplexType.FUNCTION, value: { ...func, toString: () => 'native fn' }, name: func.name });

	try {
		for (let i = 0; i < program.length - 1; i++)
			interpret_expr(environment, program[i]);

		if (program.length > 0)
			return logRuntimeVal(interpret_expr(environment, program[program.length - 1]));
	}
	catch (err) {
		if (err instanceof RuntimeError)
			runtimeError(err);
	}
	return '';
}
