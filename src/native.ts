import { Environment } from './environment.ts';
import { BaseType, ExprType } from './expr.ts';
import { Callable, RuntimeError, truthy } from './interpreter.ts';
import { Token } from './token.ts';
import { LValBoolean, LValNil, LValNumber, RuntimeList, RuntimeNumber, RuntimeVal } from './types.ts';

type NativeFunc = Omit<Callable, 'toString'> & { name: string, return_type: ExprType };

const arithmetic_funcs: NativeFunc[] = [
	{
		name: '+',
		arity: -1,
		params: [],
		params_rest: { type: BaseType.NUMBER },
		return_type: { type: BaseType.NUMBER },
		call: (_env: Environment<RuntimeVal>, args: RuntimeVal[]) => {
			let sum = 0;
			for (const arg of args)
				sum += (arg as LValNumber).value;

			return new LValNumber(sum);
		}
	},
	{
		name: '-',
		arity: -1,
		params: [],
		params_rest: { type: BaseType.NUMBER },
		return_type: { type: BaseType.NUMBER },
		call: (_env: Environment<RuntimeVal>, args: RuntimeVal[]) => {
			let difference = (args[0] as LValNumber).value;

			for (let i = 1; i < args.length; i++)
				difference -= (args[i] as LValNumber).value;

			return new LValNumber(difference);
		}
	},
	{
		name: '=',
		arity: -1,
		params: [{ type: BaseType.ANY }],
		params_rest: { type: BaseType.ANY },
		return_type: { type: BaseType.BOOLEAN },
		call: (_env: Environment<RuntimeVal>, args: RuntimeVal[]) => {
			let result = true;
			for (let i = 1; i < args.length; i++)
				result &&= args[0].type === args[i].type && Bun.deepEquals(args[0].value, args[1].value);

			return new LValBoolean(result);
		}
	},
	{
		name: 'mod',
		arity: 2,
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
		arity: 1,
		params: [{ type: BaseType.ANY }],
		return_type: { type: BaseType.BOOLEAN },
		call: (_env: Environment<RuntimeVal>, args: RuntimeVal[]) => {
			return new LValBoolean(!truthy(args[0]));
		}
	},
	{
		name: 'or',
		arity: -1,
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
		arity: -1,
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
		name: 'print',
		arity: -1,
		params: [],
		params_rest: { type: BaseType.ANY },
		return_type: { type: BaseType.NIL },
		call: (_env: Environment<RuntimeVal>, args: RuntimeVal[]) => {
			for (const arg of args)
				console.log(JSON.stringify(arg));

			return new LValNil();
		}
	}
];

const list_funcs: NativeFunc[] = [
	{
		name: 'list',
		arity: -1,
		params: [],
		params_rest: { type: BaseType.ANY },
		return_type: { type: BaseType.LIST },
		call: (_env: Environment<RuntimeVal>, args: RuntimeVal[]) => {
			return { type: BaseType.LIST, value: args };
		}
	},
	{
		name: 'cons',
		arity: 2,
		params: [{ type: BaseType.ANY }, { type: BaseType.LIST }],
		return_type: { type: BaseType.LIST },
		call: (_env: Environment<RuntimeVal>, args: RuntimeVal[]) => {
			return { type: BaseType.LIST, value: [args[0], ...(args[1] as RuntimeList).value] };
		}
	},
	{
		name: 'pop',
		arity: 1,
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
		name: 'nth',
		arity: 2,
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
		name: 'count',
		arity: 1,
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
		arity: 2,
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
