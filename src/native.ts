import { Environment } from './environment.ts';
import { Callable, RuntimeError, truthy } from './interpreter.ts';
import { Token } from './token.ts';
import { LVal, LValBoolean, LValList, LValNil, LValNumber, LValSymbol, LValType } from './types.ts';

type NativeFunc = Omit<Callable, 'toString'> & { name: string };

const arithmetic_funcs: NativeFunc[] = [
	{
		name: '+',
		arity: -1,
		params: [],
		params_rest: [LValType.NUMBER],
		call: (_env: Environment<LVal>, args: LVal[]) => {
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
		params_rest: [LValType.NUMBER],
		call: (_env: Environment<LVal>, args: LVal[]) => {
			let difference = (args[0] as LValNumber).value;

			for (let i = 1; i < args.length; i++)
				difference -= (args[i] as LValNumber).value;

			return new LValNumber(difference);
		}
	},
	{
		name: '=',
		arity: -1,
		params: [LValType.ANY],
		params_rest: [LValType.ANY],
		call: (_env: Environment<LVal>, args: LVal[]) => {
			let result = true;
			for (let i = 1; i < args.length; i++)
				result &&= args[0].type === args[i].type && Bun.deepEquals(args[0].value, args[1].value);

			return new LValBoolean(result);
		}
	},
	{
		name: 'mod',
		arity: 2,
		params: [LValType.NUMBER, LValType.NUMBER],
		params_rest: [],
		call: (_env: Environment<LVal>, args: LVal[]) => {
			const a = (args[0] as LValNumber).value;
			const b = (args[1] as LValNumber).value;
			return new LValNumber(a % b);
		}
	}
];

const logical_funcs: NativeFunc[] = [
	{
		name: 'or',
		arity: -1,
		params: [],
		params_rest: [LValType.ANY],
		call: (_env: Environment<LVal>, args: LVal[]) => {
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
		params_rest: [LValType.ANY],
		call: (_env: Environment<LVal>, args: LVal[]) => {
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
		params_rest: [LValType.ANY],
		call: (_env: Environment<LVal>, args: LVal[]) => {
			for (const arg of args)
				console.log(JSON.stringify(arg));

			return new LValNil();
		}
	}
];

const list_funcs: NativeFunc[] = [
	{
		name: 'cons',
		arity: 2,
		params: [LValType.ANY, LValType.LIST],
		params_rest: [],
		call: (_env: Environment<LVal>, args: LVal[]) => {
			return new LValList([args[0], ...(args[1] as LValList).value]);
		}
	},
	{
		name: 'peek',
		arity: 1,
		params: [LValType.LIST],
		params_rest: [],
		call: (_env: Environment<LVal>, args: LVal[]) => {
			return (args[0] as LValList).value[0] ?? new LValNil();
		}
	},
	{
		name: 'pop',
		arity: 1,
		params: [LValType.LIST],
		params_rest: [],
		call: (_env: Environment<LVal>, args: LVal[], token: Token) => {
			const list = (args[0] as LValList).value;

			if (list.length === 0)
				throw new RuntimeError(token, `Can't pop empty list!`);

			return new LValList(list.slice(1));
		}
	},
	{
		name: 'nth',
		arity: 2,
		params: [LValType.LIST, LValType.NUMBER],
		params_rest: [],
		call: (_env: Environment<LVal>, args: LVal[], token: Token) => {
			const list = (args[0] as LValList).value;
			const index = (args[1] as LValNumber).value;

			if (index < 0 || index >= list.length)
				throw new RuntimeError(token, `nth index out of bounds!`);

			return list[index];
		}
	},
	{
		name: 'count',
		arity: 1,
		params: [LValType.LIST],
		params_rest: [],
		call: (_env: Environment<LVal>, args: LVal[]) => {
			return new LValNumber((args[0] as LValList).value.length);
		}
	}
];

export const native_macros: NativeFunc[] = [
	{
		name: 'when',
		arity: 2,
		params: [LValType.ANY, LValType.ANY],
		params_rest: [LValType.ANY],
		// (defmacro when [test & body] (list 'if test (cons 'do body)))
		call: (_env: Environment<LVal>, args: LVal[], token: Token) => {
			const elements: LVal[] = [
				new LValSymbol({ ...token, lexeme: 'if' }), args[0],
				new LValList([new LValSymbol({ ...token, lexeme: 'do' }), ...args.slice(1)])];

			return new LValList(elements, token);
		}
	}
];

export const native_funcs: NativeFunc[] = [
	...arithmetic_funcs,
	...logical_funcs,
	...io_funcs,
	...list_funcs
];
