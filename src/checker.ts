import { Environment } from './environment.ts';
import { BaseType, Binding, ComplexType, DoExpr, Expr, ExprType, FnExpr, IfExpr, LetExpr, ListExpr, narrow, satisfies, SExpr, SymbolExpr, VectorExpr } from './expr.ts';
import { compileError } from './main.ts';
import { native_funcs } from './native.ts';
import { Token, TokenType } from './token.ts';
import { LVal, LValBoolean, LValList, LValNil, LValNumber, LValString, LValSymbol, LValVector } from './types.ts';

export class CompileError extends Error {
	token?: Token;

	constructor(token: Token | undefined, message: string) {
		super(message);
		this.token = token;
	}
}

export function argError(op: LValSymbol, args: LVal[]) {
	return new CompileError(op.value, `Wrong number of args (${args.length}) passed to ${op.value.lexeme}.`);
}

function check_symbol(env: Environment<Expr>, val: LValSymbol) {
	const res = env.retrieve(val.value);

	if (res.return_type.type === ComplexType.FUNCTION)
		return res;

	return new SymbolExpr(val.value, new Set([val.value.lexeme]), res.return_type);
}

function check_list(env: Environment<Expr>, val: LValList) {
	const children = val.value.map(v => check_val(env, v));
	return new ListExpr(children, val.l_paren);
}

function check_vector(env: Environment<Expr>, val: LValVector) {
	const children = val.value.map(v => check_val(env, v));
	return new VectorExpr(children, val.l_paren);
}

function check_primary(env: Environment<Expr>, val: LVal) {
	if (val instanceof LValNumber || val instanceof LValString || val instanceof LValBoolean || val instanceof LValNil)
		return val;

	if (val instanceof LValSymbol)
		return check_symbol(env, val);

	if (val instanceof LValVector)
		return check_vector(env, val);

	return check_list(env, val);
}

function check_if(env: Environment<Expr>, op: LValSymbol, args: LVal[]) {
	if (args.length < 2 || args.length > 3)
		throw argError(op, args);

	const [cond_expr, truthy_expr, falsy_expr = new LValNil()] = args;

	const cond = check_val(env, cond_expr);
	const true_child = check_val(env, truthy_expr);
	const false_child = check_val(env, falsy_expr);

	if (!satisfies(false_child.return_type, true_child.return_type))
		throw new CompileError(op.value, `Types of true child (${JSON.stringify(true_child.return_type)}) and false child (${JSON.stringify(false_child.return_type)}) don't match.`);

	const captured_symbols = cond.captured_symbols.union(true_child.captured_symbols).union(false_child.captured_symbols);

	return new IfExpr(cond, true_child, false_child, captured_symbols, true_child.return_type);
}

function check_fn(env: Environment<Expr>, op: LValSymbol, args: LVal[], def = false) {
	if (args.length < 2 || args.length > 3)
		throw argError(op, args);

	if (def && args.length === 2)
		throw new CompileError(op.value, 'Functions defined using defn must have a name.');

	let name: LVal | undefined;
	let params_expr: LVal;
	let body_expr: LVal;

	if (def || args[0] instanceof LValSymbol)
		[name, params_expr, body_expr] = args;
	else
		[params_expr, body_expr] = args;

	if (name !== undefined && !(name instanceof LValSymbol))
		throw new CompileError(op.value, 'Functions defined using defn must have a name.');

	if (!(params_expr instanceof LValVector) || !params_expr.value.every(param => param instanceof LValSymbol))
		throw new CompileError(op.value, 'Expected a vector of symbols for parameters.');

	const param_symbols = new Set(params_expr.value.map(p => p.value.lexeme));
	const params = params_expr.value.map(lval => lval.value);

	const nested = new Environment(env);

	for (let i = 0; i < params.length; i++) {
		const param = params[i].lexeme;
		const token = { type: TokenType.SYMBOL, literal: undefined, lexeme: param, line: -1 };
		nested.define(param, new SymbolExpr(token, new Set<string>(), { type: ComplexType.POLY, sym: Symbol(param), narrowable: true }));
	}

	if (name !== undefined)
		nested.define(name.value.lexeme, new FnExpr(def, params, new LValNil(), { type: ComplexType.POLY, sym: Symbol(name.value.lexeme), narrowable: true }, new Set<string>(), op.value, { name: name.value.lexeme }));

	const body = check_val(nested, body_expr);

	if (body.return_type.type === ComplexType.POLY)
		body.return_type.narrowable = false;

	if (def) {
		const fn = new FnExpr(def, params, body, { type: BaseType.NIL }, body.captured_symbols.difference(param_symbols), op.value, { name: name?.value.lexeme });
		env.define(name!.value.lexeme, fn);
		return fn;
	}
	else {
		const return_type = {
			type: ComplexType.FUNCTION as const,
			arity: params.length,
			params: params.map(p => nested.retrieve(p).return_type),
			return_type: body.return_type
		};
		const fn = new FnExpr(def, params, body, return_type, body.captured_symbols.difference(param_symbols), op.value, { name: name?.value.lexeme });
		return fn;
	}
}

function check_let(env: Environment<Expr>, op: LValSymbol, args: LVal[]) {
	if (args.length !== 2)
		throw argError(op, args);

	const [bindings_expr, body_expr] = args;

	if (!(bindings_expr instanceof LValVector) || bindings_expr.value.length % 2 !== 0)
		throw new CompileError(op.value, 'Expected an even number of forms in bindings vector.');

	const nested = new Environment(env);
	const bindings: Binding[] = [];
	const local_vars = new Set<string>();

	for (let i = 0; i < bindings_expr.value.length; i += 2) {
		const symbol = bindings_expr.value[i];
		const value = check_val(nested, bindings_expr.value[i + 1]);

		if (!(symbol instanceof LValSymbol))
			throw new CompileError(op.value, 'Expected a symbol in bindings vector.');

		nested.define(symbol.value.lexeme, value);
		bindings.push({ key: symbol.value, value });
		local_vars.add(symbol.value.lexeme);
	}

	const body = check_val(nested, body_expr);

	return new LetExpr(bindings, body, body.captured_symbols.difference(local_vars), body.return_type);
}

function check_do(env: Environment<Expr>, op: LValSymbol, args: LVal[]) {
	if (args.length === 0)
		return new LValNil();

	const bodies: Expr[] = [];
	let captured_symbols = new Set<string>();

	for (const arg of args) {
		const body = check_val(env, arg);
		bodies.push(body);
		captured_symbols = captured_symbols.union(body.captured_symbols);
	}

	return new DoExpr(bodies, captured_symbols, bodies[bodies.length - 1].return_type, op.value);
}

function check_s(env: Environment<Expr>, op: LValSymbol | LValList, args: LVal[]) {
	const func_expr = check_val(env, op);
	const token = (op instanceof LValList) ? op.l_paren : op.value;

	if ((!(func_expr instanceof SExpr || func_expr instanceof SymbolExpr || func_expr instanceof FnExpr) || func_expr.return_type.type !== ComplexType.FUNCTION))
		throw new CompileError(token, `${op instanceof LValList ? 'List' : `Symbol ${token.lexeme}`} is not a function.`);

	const { return_type: func_type } = func_expr;
	const { arity, params, params_rest } = func_type;

	const expected_arity = arity === -1 ? args.length : arity;

	if (expected_arity !== args.length)
		throw new CompileError(token, `Function requires ${expected_arity} parameters, got ${args.length}.`);

	const evaluated_args = args.map(arg => check_val(env, arg));

	if (params.length > 0 || params_rest !== undefined) {
		for (let i = 0; i < evaluated_args.length; i++) {
			const arg = evaluated_args[i];
			const expected_type = params[i] ?? params_rest;

			if (!satisfies(arg.return_type, expected_type))
				throw new CompileError(token, `Parameter ${i + 1} to function (${args[i].toString()}, type ${arg.return_type.type}) doesn't match expected type ${expected_type.type}.`);

			if (arg.return_type.type === ComplexType.POLY && arg.return_type.narrowable) {
				console.log('assinging to', arg.toString(), arg.return_type);
				Object.assign(arg.return_type, narrow(arg.return_type, expected_type));
			}
		}
	}

	const s_op = op instanceof LValSymbol ? new SymbolExpr(op.value, new Set(), func_type.return_type) : func_expr;
	const captured_symbols = evaluated_args.reduce((a, c) => a.union(c.captured_symbols), new Set<string>());

	return new SExpr(s_op, evaluated_args, captured_symbols, func_type.return_type, token);
}

export function check_val(env: Environment<Expr>, val: LVal): Expr {
	if (val instanceof LValNumber || val instanceof LValString || val instanceof LValBoolean || val instanceof LValNil)
		return val;

	if (val instanceof LValSymbol)
		return check_symbol(env, val);

	if (val instanceof LValVector)
		return check_vector(env, val);

	if (val instanceof LValList) {
		const [op, ...args] = val.value;

		if (op instanceof LValSymbol) {
			const name = op.value.lexeme;

			if (name === 'quote') {
				if (args.length !== 1)
					throw argError(op, args);

				return check_primary(env, args[0]);
			}

			if (name === 'if')
				return check_if(env, op, args);

			if (name === 'fn' || name === 'defn')
				return check_fn(env, op, args, name === 'defn');

			if (name === 'let')
				return check_let(env, op, args);

			if (name === 'do')
				return check_do(env, op, args);

			return check_s(env, op, args);
		}
		else if (op instanceof LValList) {
			return check_s(env, op, args);
		}

		throw new CompileError(val.l_paren, `Expected symbol/s-expression, got ${JSON.stringify(op)}.`);
	}
	return val;
}

export function static_check(program: LVal[]) {
	const env = new Environment<Expr>();

	for (const { name, arity, params, params_rest, return_type } of native_funcs) {
		const type: ExprType = {
			type: ComplexType.FUNCTION,
			arity,
			params,
			params_rest,
			return_type
		};
		const dummy_token = { type: TokenType.NIL, literal: undefined, lexeme: '', line: -1 };
		const optionals = { name, params_rest: params_rest !== undefined ? dummy_token : undefined };
		env.define(name, new FnExpr(true, params.map(_ => dummy_token), new LValNil(), type, new Set<string>(), dummy_token, optionals));
	}

	try {
		const exprs = program.map(val => check_val(env, val));
		return exprs;
	}
	catch (err) {
		if (err instanceof CompileError)
			compileError(err);
		else
			console.error(err);
	}

	return [];
}
