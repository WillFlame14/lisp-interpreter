import { Environment } from './environment.ts';
import { runtimeError } from './main.ts';
import { native_funcs } from './native.ts';
import { Token } from './token.ts';
import { LVal, LValBoolean, LValFunction, LValList, LValNil, LValNumber, LValString, LValSymbol, LValType, LValVector } from './types.ts';

export class RuntimeError extends Error {
	token: Token;

	constructor(token: Token, message: string) {
		super(message);
		this.token = token;
	}
}

export function truthy(lval: LVal) {
	return !((lval instanceof LValBoolean && !lval.value) || lval instanceof LValNil);
}

export interface Callable {
	name?: string;
	macro?: boolean;
	arity: number;
	params: LValType[];
	params_rest: LValType[];
	call: (inner_env: Environment<LVal>, args: LVal[], token: Token) => LVal;
	toString: string;
}

export function argError(op: LValSymbol, args: LVal[]) {
	return new RuntimeError(op.value, `Wrong number of args (${args.length}) passed to ${op.value.lexeme}.`);
}

function interpret_if(env: Environment<LVal>, op: LValSymbol, args: LVal[]) {
	if (args.length < 2 || args.length > 3)
		throw argError(op, args);

	const [cond, truthy_expr, falsy_expr = new LValNil()] = args;
	const condition = interpret_expr(env, cond);

	if (truthy(condition))
		return interpret_expr(env, truthy_expr);

	return interpret_expr(env, falsy_expr);
}

function interpret_fn(env: Environment<LVal>, op: LValSymbol, args: LVal[]) {
	if (args.length < 2)
		throw argError(op, args);

	let name: LValSymbol | undefined;
	let params: LVal;
	let body: LVal;

	if (args[0] instanceof LValSymbol)
		[name, params, body] = args;
	else
		[params, body] = args;

	if (!(params instanceof LValVector) || !params.value.every(param => param instanceof LValSymbol))
		throw new RuntimeError(op.value, 'Expected a vector of symbols.');

	const func: Callable = {
		arity: params.value.length,
		params: [],
		params_rest: [],
		call: (_inner_env: Environment<LVal>, args: LVal[]) => {
			const nested = new Environment(env);

			for (let i = 0; i < args.length; i++) {
				const param = (params.value[i] as LValSymbol).value.lexeme;
				nested.define(param, args[i]);
			}

			if (name !== undefined)
				env.define(name.value.lexeme, new LValFunction(func, name.value.lexeme));

			return interpret_expr(nested, body);
		},
		toString: body.toString()
	};

	return new LValFunction(func, name?.value.lexeme);
}

function interpret_let(env: Environment<LVal>, op: LValSymbol, args: LVal[]) {
	if (args.length !== 2)
		throw argError(op, args);

	const [bindings, body] = args;

	if (!(bindings instanceof LValVector) || bindings.value.length % 2 !== 0)
		throw new RuntimeError(op.value, 'Expected an even number of forms in bindings vector.');

	const nested = new Environment(env);

	for (let i = 0; i < bindings.value.length; i += 2) {
		const symbol = bindings.value[i];
		const value = interpret_expr(nested, bindings.value[i + 1]);

		if (!(symbol instanceof LValSymbol))
			throw new RuntimeError(op.value, 'Expected a symbol in bindings vector.');

		nested.define(symbol.value.lexeme, value);
	}

	return interpret_expr(nested, body);
}

function interpret_s(env: Environment<LVal>, op: LValSymbol, args: LVal[]) {
	const func = env.retrieve(op.value);

	if (!(func instanceof LValFunction))
		throw new RuntimeError(op.value, `Symbol ${op.value.lexeme} is not a function.`);

	const { arity, params, params_rest } = func.value;

	const expected_arity = arity === -1 ? args.length : func.value.arity;

	if (expected_arity !== args.length)
		throw new RuntimeError(op.value, `Function requires ${expected_arity} parameters, got ${args.length}.`);

	const evaluated_args = args.map(arg => interpret_expr(env, arg));

	if (params.length > 0) {
		for (let i = 0; i < evaluated_args.length; i++) {
			const arg = evaluated_args[i];
			const expected_type = params[i] ?? params_rest[(i - params.length) % params_rest.length];

			if (expected_type === LValType.ANY)
				continue;

			if (arg.type !== expected_type)
				throw new RuntimeError(op.value, `Parameter ${i + 1} to function (${JSON.stringify(evaluated_args[i])}) doesn't match expected type ${expected_type}.`);
		}
	}

	const result = func.value.call(env, evaluated_args, op.value);

	return result;
}

export function interpret_expr(env: Environment<LVal>, expr: LVal): LVal {
	if (expr instanceof LValNumber || expr instanceof LValString || expr instanceof LValBoolean || expr instanceof LValNil)
		return expr;

	if (expr instanceof LValSymbol)
		return env.retrieve(expr.value);

	if (expr instanceof LValVector) {
		expr.value = expr.value.map(e => interpret_expr(env, e));
		return expr;
	}

	if (expr instanceof LValList) {
		const [op, ...args] = expr.value;

		if (op instanceof LValSymbol) {
			const name = op.value.lexeme;

			if (name === 'quote') {
				if (args.length !== 1)
					throw argError(op, args);

				return args[0];
			}

			if (name === 'if')
				return interpret_if(env, op, args);

			if (name === 'fn')
				return interpret_fn(env, op, args);

			if (name === 'let')
				return interpret_let(env, op, args);

			return interpret_s(env, op, args);
		}

		throw new Error(`Expected symbol, got ${JSON.stringify(op)}.`);
	}
	return expr;
}

export function interpret(program: LVal[]) {
	const environment = new Environment<LVal>();

	for (const func of native_funcs)
		environment.define(func.name, new LValFunction({ ...func, toString: '<native fn>' }, func.name));

	try {
		for (let i = 0; i < program.length - 1; i++)
			interpret_expr(environment, program[i]);

		if (program.length > 0)
			return interpret_expr(environment, program[program.length - 1]);
	}
	catch (err) {
		if (err instanceof RuntimeError)
			runtimeError(err);
	}
}
