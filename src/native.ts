import { Environment } from './environment.ts';
import { BaseType, ExprType } from './expr.ts';
import { Callable, RuntimeError, truthy } from './interpreter.ts';
import { Token } from './token.ts';
import { logRuntimeVal, LValBoolean, LValNil, LValNumber, RuntimeList, RuntimeNumber, RuntimeVal } from './types.ts';

type NativeFunc = Omit<Callable, 'toString'> & { name: string, return_type: ExprType };

const arithmetic_funcs: NativeFunc[] = [
	{
		name: '__plus',
		params: [{ type: BaseType.NUMBER }, { type: BaseType.NUMBER }],
		return_type: { type: BaseType.NUMBER },
		call: (_env: Environment<RuntimeVal>, args: RuntimeVal[]) => {
			const [a, b] = args as LValNumber[];
			return new LValNumber(a.value + b.value);
		}
	},
	{
		name: '__minus',
		params: [{ type: BaseType.NUMBER }, { type: BaseType.NUMBER }],
		return_type: { type: BaseType.NUMBER },
		call: (_env: Environment<RuntimeVal>, args: RuntimeVal[]) => {
			const [a, b] = args as LValNumber[];
			return new LValNumber(b.value - a.value);
		}
	},
	{
		name: '__eq',
		params: [{ type: BaseType.ANY }, { type: BaseType.ANY }],
		return_type: { type: BaseType.BOOLEAN },
		call: (_env: Environment<RuntimeVal>, args: RuntimeVal[]) => {
			return new LValBoolean(Bun.deepEquals(args[0].value, args[1].value));
		}
	},
	{
		name: 'mod',
		params: [{ type: BaseType.NUMBER }, { type: BaseType.NUMBER }],
		return_type: { type: BaseType.NUMBER },
		call: (_env: Environment<RuntimeVal>, args: RuntimeVal[]) => {
			const a = (args[0] as LValNumber).value;
			const b = (args[1] as LValNumber).value;
			return new LValNumber(a % b);
		}
	}
];

const logical_funcs: NativeFunc[] = [
	{
		name: 'not',
		params: [{ type: BaseType.ANY }],
		return_type: { type: BaseType.BOOLEAN },
		call: (_env: Environment<RuntimeVal>, args: RuntimeVal[]) => {
			return new LValBoolean(!truthy(args[0]));
		}
	},
	{
		name: 'or',
		params: [],
		params_rest: { type: BaseType.ANY },
		return_type: { type: BaseType.BOOLEAN },
		call: (_env: Environment<RuntimeVal>, args: RuntimeVal[]) => {
			if (args.length === 0)
				return new LValNil();

			const first_truthy = args.find(truthy);

			if (first_truthy !== undefined)
				return first_truthy;

			return args.at(-1) ?? new LValNil();
		}
	},
	{
		name: 'and',
		params: [],
		params_rest: { type: BaseType.ANY },
		return_type: { type: BaseType.BOOLEAN },
		call: (_env: Environment<RuntimeVal>, args: RuntimeVal[]) => {
			if (args.length === 0)
				return new LValBoolean(true);

			const first_falsey = args.find(arg => !truthy(arg));

			if (first_falsey !== undefined)
				return first_falsey;

			return args.at(-1) ?? new LValBoolean(true);
		}
	}
];

const io_funcs: NativeFunc[] = [
	{
		name: '__print',
		params: [],
		params_rest: { type: BaseType.ANY },
		return_type: { type: BaseType.NIL },
		call: (_env: Environment<RuntimeVal>, args: RuntimeVal[]) => {
			console.log(args.map(logRuntimeVal));
			return new LValNil();
		}
	}
];

const list_funcs: NativeFunc[] = [
	{
		name: 'list',
		params: [],
		params_rest: { type: BaseType.ANY },
		return_type: { type: BaseType.LIST },
		call: (_env: Environment<RuntimeVal>, args: RuntimeVal[]) => {
			return { type: BaseType.LIST, value: args };
		}
	},
	{
		name: '__cons',
		params: [{ type: BaseType.ANY }, { type: BaseType.LIST }],
		return_type: { type: BaseType.LIST },
		call: (_env: Environment<RuntimeVal>, args: RuntimeVal[]) => {
			return { type: BaseType.LIST, value: [args[0], ...(args[1] as RuntimeList).value] };
		}
	},
	{
		name: '__pop',
		params: [{ type: BaseType.LIST }],
		return_type: { type: BaseType.LIST },
		call: (_env: Environment<RuntimeVal>, args: RuntimeVal[], token: Token) => {
			const list = (args[0] as RuntimeList).value;

			if (list.length === 0)
				throw new RuntimeError(token, `Can't pop empty list!`);

			return { type: BaseType.LIST, value: list.slice(1) };
		}
	},
	{
		name: '__nth',
		params: [{ type: BaseType.LIST }, { type: BaseType.NUMBER }],
		return_type: { type: BaseType.ANY },
		call: (_env: Environment<RuntimeVal>, args: RuntimeVal[], token: Token) => {
			const list = (args[0] as RuntimeList).value;
			const index = (args[1] as RuntimeNumber).value;

			if (index < 0 || index >= list.length)
				throw new RuntimeError(token, `nth index out of bounds!`);

			return list[index];
		}
	},
	{
		name: '__count',
		params: [{ type: BaseType.LIST }],
		return_type: { type: BaseType.NUMBER },
		call: (_env: Environment<RuntimeVal>, args: RuntimeVal[]) => {
			return new LValNumber((args[0] as RuntimeList).value.length);
		}
	}
];

export const native_macros: NativeFunc[] = [
	{
		name: 'when',
		macro: true,
		params: [{ type: BaseType.ANY }, { type: BaseType.ANY }],
		params_rest: { type: BaseType.ANY },
		return_type: { type: BaseType.LIST },
		// (defmacro when [test & body] (list 'if test (cons 'do body)))
		call: (_env: Environment<RuntimeVal>, args: RuntimeVal[], token: Token) => {
			const elements: RuntimeVal[] = [
				{ type: BaseType.SYMBOL, value: { ...token, lexeme: 'if' } }, args[0],
				{ type: BaseType.LIST, value: [{ type: BaseType.SYMBOL, value: { ...token, lexeme: 'do' } }, ...args.slice(1)] }
			];

			return { type: BaseType.LIST, value: elements };
		}
	}
];

export const native_funcs: NativeFunc[] = [
	...arithmetic_funcs,
	...logical_funcs,
	...io_funcs,
	...list_funcs
];
