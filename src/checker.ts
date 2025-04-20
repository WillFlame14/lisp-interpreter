import { Environment } from './environment.ts';
import { BaseType, Binding, ComplexType, DoExpr, Expr, ExprType, FnExpr, IfExpr, LetExpr, ListExpr, narrow, PrimaryExpr, satisfies, SExpr, SymbolExpr, VectorExpr } from './expr.ts';
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

	return new SymbolExpr(val.value, [val.value], res.return_type);
}

function check_list(env: Environment<Expr>, val: LValList) {
	const children = val.value.map(v => check_primary(env, v));
	return new ListExpr(children, val.l_paren);
}

function check_vector(env: Environment<Expr>, val: LValVector) {
	const children = val.value.map(v => check_primary(env, v));
	return new VectorExpr(children, val.l_paren);
}

function check_primary(env: Environment<Expr>, val: LVal): PrimaryExpr {
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

	const captured_symbols = cond.captured_symbols;

	for (const sym of true_child.captured_symbols.concat(false_child.captured_symbols)) {
		if (!captured_symbols.some(s => s.lexeme === sym.lexeme))
			captured_symbols.push(sym);
	}

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

	const param_symbols = new Set(params_expr.value.map(p => p.value));
	const params = params_expr.value.map(lval => lval.value);

	const nested = new Environment(env);
	let params_rest: Token | undefined = undefined;

	for (let i = 0; i < params.length; i++) {
		const param = params[i].lexeme;

		if (param === '&') {
			if (i !== params.length - 2)
				throw new CompileError(op.value, 'Variadic functions must have & followed by exactly one symbol.');

			params_rest = params[params.length - 1];
			const token = { type: TokenType.SYMBOL, literal: undefined, lexeme: params_rest.lexeme, line: -1 };
			nested.define(params_rest.lexeme, new SymbolExpr(token, [], { type: BaseType.LIST }));

			// Cut these off the parameter list
			params.splice(params.length - 2, 2);
			break;
		}
		const token = { type: TokenType.SYMBOL, literal: undefined, lexeme: param, line: -1 };
		nested.define(param, new SymbolExpr(token, [], { type: ComplexType.POLY, sym: Symbol(param), narrowable: true }));
	}

	if (name !== undefined) {
		const return_type = {
			type: ComplexType.FUNCTION as const,
			params: params.map(p => nested.retrieve(p).return_type),
			params_rest: params_rest === undefined ? undefined : { type: BaseType.LIST },
			return_type: { type: ComplexType.POLY, sym: Symbol(name.value.lexeme), narrowable: true }
		} as const;
		nested.define(name.value.lexeme, new FnExpr(def, params, new LValNil(), return_type, [], op.value, { name: name.value.lexeme, params_rest }));
	}

	const body = check_val(nested, body_expr);

	if (body.return_type.type === ComplexType.POLY)
		body.return_type.narrowable = false;

	const return_type = {
		type: ComplexType.FUNCTION as const,
		params: params.map(p => nested.retrieve(p).return_type),
		params_rest: params_rest === undefined ? undefined : { type: BaseType.LIST },
		return_type: body.return_type
	};

	const captured_symbols = body.captured_symbols;

	for (const { lexeme } of param_symbols) {
		const found = captured_symbols.findIndex(s => s.lexeme === lexeme);

		if (found !== -1)
			captured_symbols.splice(found, 1);
	}

	const fn = new FnExpr(def, params, body, return_type, captured_symbols, op.value, { name: name?.value.lexeme, params_rest });

	if (def)
		env.define(name!.value.lexeme, fn);

	return fn;
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

	return new LetExpr(bindings, body, body.captured_symbols.filter(s => !local_vars.has(s.lexeme)), body.return_type);
}

function check_do(env: Environment<Expr>, op: LValSymbol, args: LVal[]) {
	if (args.length === 0)
		return new LValNil();

	const bodies: Expr[] = [];
	const captured_symbols: Token[] = [];

	for (const arg of args) {
		const body = check_val(env, arg);
		bodies.push(body);

		for (const sym of body.captured_symbols) {
			if (!captured_symbols.some(s => s.lexeme === sym.lexeme))
				captured_symbols.push(sym);
		}
	}

	return new DoExpr(bodies, captured_symbols, bodies[bodies.length - 1].return_type, op.value);
}

function check_s(env: Environment<Expr>, op: LValSymbol | LValList, args: LVal[]) {
	const func_expr = check_val(env, op);
	const token = (op instanceof LValList) ? op.l_paren : op.value;

	const is_func = func_expr instanceof SExpr || func_expr instanceof SymbolExpr || func_expr instanceof FnExpr;

	if (!is_func)
		throw new CompileError(token, `${op instanceof LValList ? 'List' : `Symbol ${token.lexeme}`} is not a function (got ${func_expr.toString()}).`);

	if (func_expr.return_type.type !== ComplexType.POLY && func_expr.return_type.type !== ComplexType.FUNCTION)
		throw new CompileError(token, `${op instanceof LValList ? 'List' : `Symbol ${token.lexeme}`} is not a function (got ${func_expr.toString()}).`);

	if (func_expr.return_type.type === ComplexType.FUNCTION) {
		const { return_type: func_type } = func_expr;
		const { params, params_rest } = func_type;

		if (params_rest === undefined && params.length !== args.length)
			throw new CompileError(token, `Function requires ${params.length} parameters, got ${args.length}.`);

		const evaluated_args = args.map(arg => check_val(env, arg));

		// Check specified param types
		if (params.length > 0) {
			for (let i = 0; i < params.length; i++) {
				const arg = evaluated_args[i];
				const expected_type = params[i];

				if (!satisfies(arg.return_type, expected_type))
					throw new CompileError(token, `Parameter ${i + 1} to function ${token.lexeme} (${args[i].toString()}, type ${arg.return_type.type}) doesn't match expected type ${expected_type.type}.`);

				if (arg.return_type.type === ComplexType.POLY && arg.return_type.narrowable)
					Object.assign(arg.return_type, narrow(arg.return_type, expected_type));
			}
		}

		const s_op = op instanceof LValSymbol ? new SymbolExpr(op.value, [], func_type.return_type) : func_expr;
		const captured_symbols = evaluated_args.reduce<Token[]>((a, c) => a.concat(c.captured_symbols.filter(s => !a.some(as => as.lexeme === s.lexeme))), []);

		return new SExpr(s_op, evaluated_args, captured_symbols, func_type.return_type, token);
	}
	else {
		const evaluated_args = args.map(arg => check_val(env, arg));
		const return_type = { type: ComplexType.POLY, sym: Symbol(token.lexeme), narrowable: true } as const;

		if (func_expr.return_type.narrowable) {
			Object.assign(func_expr.return_type, {
				type: ComplexType.FUNCTION,
				params: evaluated_args.map(a => a.return_type),
				return_type
			});
		}

		const s_op = op instanceof LValSymbol ? new SymbolExpr(op.value, [], return_type) : func_expr;
		const captured_symbols = evaluated_args.reduce<Token[]>((a, c) => a.concat(c.captured_symbols.filter(s => !a.some(as => as.lexeme === s.lexeme))), []);
		return new SExpr(s_op, evaluated_args, captured_symbols, return_type, token);
	}
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

	for (const { name, params, params_rest, return_type } of native_funcs) {
		const type: ExprType = {
			type: ComplexType.FUNCTION,
			params,
			params_rest,
			return_type
		};
		const dummy_token = { type: TokenType.NIL, literal: undefined, lexeme: '', line: -1 };
		const optionals = { name, params_rest: params_rest !== undefined ? dummy_token : undefined };
		env.define(name, new FnExpr(true, params.map(_ => dummy_token), new LValNil(), type, [], dummy_token, optionals));
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
