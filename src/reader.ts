import { Environment } from './environment.ts';
import { Callable, interpret_expr, RuntimeError } from './interpreter.ts';
import { native_funcs, native_macros } from './native.ts';
import { LVal, LValFunction, LValList, LValNil, LValSymbol, LValVector } from './types.ts';

function expandMacro(env: Environment<LVal>, expr: LVal): LVal {
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
					params_rest: [],
					call: (_env: Environment<LVal>, args: LVal[]) => {
						const nested = new Environment(env);

						for (let i = 0; i < args.length; i++) {
							const param = (params.value[i] as LValSymbol).value.lexeme;
							nested.define(param, args[i]);
						}

						env.define(macro_name, new LValFunction(macro, macro_name));
						return interpret_expr(nested, body);
					},
					toString: body.toString(),
				};
				env.define(macro_name, new LValFunction(macro, macro_name));
				return new LValNil();
			}

			try {
				const macro = env.retrieve(op.value) as LValFunction;

				if (macro.value.macro) {
					const args = expr.value.slice(1).map(e => expandMacro(env, e));
					return macro.value.call(env, args, op.value);
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
	const env = new Environment<LVal>();

	for (const func of native_funcs)
		env.define(func.name, new LValFunction({ ...func, toString: '<native fn>' }, func.name));

	for (const macro of native_macros)
		env.define(macro.name, new LValFunction({ ...macro, toString: '<native macro>' }, macro.name));

	return program.map(expr => expandMacro(env, expr));
}
