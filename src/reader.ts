import { CompileError, static_check } from './checker.ts';
import { Environment } from './environment.ts';
import { BaseType, ComplexType } from './expr.ts';
import { Callable, interpret_expr } from './interpreter.ts';
import { native_funcs, native_macros } from './native.ts';
import { Token } from './token.ts';
import { LVal, LValBoolean, LValList, LValNil, LValNumber, LValString, LValSymbol, LValVector, RuntimeFunction, RuntimeVal } from './types.ts';

export function restore(val: RuntimeVal, token: Token): LVal {
	switch (val.type) {
		case BaseType.NUMBER:
			return new LValNumber(val.value);
		case BaseType.SYMBOL:
			return new LValSymbol(val.value);
		case BaseType.STRING:
			return new LValString(val.value);
		case BaseType.BOOLEAN:
			return new LValBoolean(val.value);
		case BaseType.NIL:
			return new LValNil();
		case BaseType.LIST:
			return new LValList(val.value.map(v => restore(v, token)), token);
		case BaseType.VECTOR:
			return new LValVector(val.value.map(v => restore(v, token)), token);
		case ComplexType.FUNCTION:
			return new LValNil();
	}
}

function expandMacro(env: Environment<RuntimeVal>, expr: LVal): LVal {
	if (expr instanceof LValList && expr.value.length > 0) {
		const op = expr.value[0];

		if (op instanceof LValSymbol) {
			const name = op.value.lexeme;

			if (name === 'quote')
				return expr;

			if (name === 'defmacro') {
				const args = expr.value.slice(1);

				if (args.length !== 3)
					throw new CompileError(op.value, `Wrong number of args (${args.length}) passed to ${op.value.lexeme}.`);

				const [symbol, params_v, body] = args;
				if (!(symbol instanceof LValSymbol))
					throw new CompileError(op.value, 'Expected a symbol as the first argument to defmacro.');

				if (!(params_v instanceof LValVector) || !params_v.value.every(param => param instanceof LValSymbol))
					throw new CompileError(op.value, 'Expected a vector of parameters as the second argument to defmacro.');

				let params_rest: Token | undefined = undefined;

				const rest_index = params_v.value.findIndex(p => p.value.lexeme === '&');
				if (rest_index !== -1) {
					if (rest_index !== params_v.value.length - 2)
						throw new CompileError(op.value, 'Variadic functions must have & followed by exactly one symbol.');

					params_rest = params_v.value.at(-1)!.value;

					// Cut these off the parameter list
					params_v.value.splice(params_v.value.length - 2, 2);
				}

				const macro_name = symbol.value.lexeme;
				const params_type = params_v.value.map(_ => ({ type: BaseType.ANY }));
				const params_rest_type = params_rest === undefined ? undefined : { type: BaseType.LIST };

				const return_type = {
					type: ComplexType.FUNCTION as const,
					params: params_type,
					params_rest: params_rest_type,
					return_type: { type: BaseType.ANY }
				};

				const macro: Callable = {
					macro: true,
					params: params_type,
					params_rest: params_rest_type,
					call: (_env: Environment<RuntimeVal>, args: RuntimeVal[]) => {
						const nested = new Environment(env);

						for (let i = 0; i < params_v.value.length; i++) {
							const param = (params_v.value[i] as LValSymbol).value.lexeme;
							nested.define(param, args[i]);
						}

						if (params_rest !== undefined)
							nested.define(params_rest.lexeme, { type: BaseType.LIST, value: args.slice(params_v.value.length) });

						env.define(macro_name, { type: ComplexType.FUNCTION, value: macro, params: params_type, params_rest: params_rest_type, return_type, name: macro_name });
						const expr = static_check([body])[0];

						return interpret_expr(nested, expr);
					},
					toString: body.toString,
				};
				env.define(macro_name, { type: ComplexType.FUNCTION, value: macro, params: params_type, params_rest: params_rest_type, return_type, name: macro_name });
				return new LValNil();
			}

			try {
				const macro = env.retrieve(op.value) as RuntimeFunction;

				if (macro.value.macro) {
					const args = expr.value.slice(1).map(e => expandMacro(env, e));
					return restore(macro.value.call(env, args, op.value), op.value);
				}
			}
			catch {
				// Function call
			}
		}
	}

	return expr;
}

export function macroexpand(program: LVal[]) {
	const env = new Environment<RuntimeVal>();

	for (const func of native_funcs) {
		const { name, params, params_rest, return_type } = func;
		const ret = {
			type: ComplexType.FUNCTION as const,
			params,
			params_rest,
			return_type
		};
		env.define(name, { type: ComplexType.FUNCTION, value: { ...func, toString: () => '<native fn>' }, params, params_rest, return_type: ret, name });
	}

	for (const macro of native_macros) {
		const { name, params, params_rest, return_type } = macro;
		const ret = {
			type: ComplexType.FUNCTION as const,
			params,
			params_rest,
			return_type
		};
		env.define(name,{ type: ComplexType.FUNCTION, value: { ...macro, toString: () => '<native macro>' }, params, params_rest, return_type: ret, name });
	}

	return program.map(expr => expandMacro(env, expr));
}
