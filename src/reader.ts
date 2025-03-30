import { static_check } from './checker.ts';
import { Environment } from './environment.ts';
import { BaseType, ComplexType } from './expr.ts';
import { Callable, interpret_expr, RuntimeError } from './interpreter.ts';
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
					throw new RuntimeError(op.value, `Wrong number of args (${args.length}) passed to ${op.value.lexeme}.`);

				const [symbol, params, body] = args;
				if (!(symbol instanceof LValSymbol))
					throw new RuntimeError(op.value, 'Expected a symbol as the first argument to defmacro.');

				if (!(params instanceof LValVector))
					throw new RuntimeError(op.value, 'Expected a vector of parameters as the second argument to defmacro.');

				const macro_name = symbol.value.lexeme;

				const macro: Callable = {
					macro: true,
					arity: params.value.length,
					params: [],
					call: (_env: Environment<RuntimeVal>, args: RuntimeVal[]) => {
						const nested = new Environment(env);

						for (let i = 0; i < args.length; i++) {
							const param = (params.value[i] as LValSymbol).value.lexeme;
							nested.define(param, args[i]);
						}

						env.define(macro_name, { type: ComplexType.FUNCTION, value: macro, name: macro_name });
						const expr = static_check([body])[0];

						return interpret_expr(nested, expr);
					},
					toString: body.toString,
				};
				env.define(macro_name, { type: ComplexType.FUNCTION, value: macro, name: macro_name });
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

	for (const func of native_funcs)
		env.define(func.name, { type: ComplexType.FUNCTION, value: { ...func, toString: () => '<native fn>' }, name: func.name });

	for (const macro of native_macros)
		env.define(macro.name,{ type: ComplexType.FUNCTION, value: { ...macro, toString: () => '<native macro>' }, name: macro.name });

	return program.map(expr => expandMacro(env, expr));
}
