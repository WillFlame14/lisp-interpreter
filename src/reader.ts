import { Environment } from './environment.ts';
import { native_macros } from './native.ts';
import { LVal, LValFunction, LValList, LValSymbol } from './types.ts';

function expandMacro(env: Environment<LVal>, expr: LVal): LVal {
	if (expr instanceof LValList && expr.value.length > 0) {
		const op = expr.value[0];

		if (op instanceof LValSymbol) {
			const name = op.value.lexeme;

			if (name === 'quote')
				return expr;

			try {
				const macro = env.retrieve(op.value) as LValFunction;
				const args = expr.value.slice(1).map(e => expandMacro(env, e));
				return macro.value.call(env, args, op.value);
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

	for (const macro of native_macros)
		env.define(macro.name, new LValFunction({ ...macro, toString: '<native macro>' }));

	return program.map(expr => expandMacro(env, expr));
}
