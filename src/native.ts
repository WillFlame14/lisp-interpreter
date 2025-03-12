import { Interpreter, RuntimeError, truthy } from './interpreter.ts';
import { Token } from './token.ts';
import { LVal, LValBoolean, LValList, LValNil, LValNumber, LValType } from './types.ts';

interface NativeFunc {
	name: string,
	arity: number;
	params: LValType[],
	params_rest: LValType[],
	call: (interpreter: Interpreter, args: LVal[], token: Token) => LVal;
}

const arithmetic_funcs: NativeFunc[] = [
	{
		name: '+',
		arity: -1,
		params: [],
		params_rest: [LValType.NUMBER],
		call: (_interpreter: Interpreter, args: LVal[]) => {
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
		call: (_interpreter: Interpreter, args: LVal[]) => {
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
		call: (_interpreter: Interpreter, args: LVal[]) => {
			let result = true;
			for (let i = 1; i < args.length; i++)
				result &&= args[0].value === args[i].value;

			return new LValBoolean(result);
		}
	},
	{
		name: 'mod',
		arity: 2,
		params: [LValType.NUMBER, LValType.NUMBER],
		params_rest: [],
		call: (_interpreter: Interpreter, args: LVal[]) => {
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
		call: (_interpreter: Interpreter, args: LVal[]) => {
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
		call: (_interpreter: Interpreter, args: LVal[]) => {
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
		call: (_interpreter: Interpreter, args: LVal[]) => {
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
		call: (_interpreter: Interpreter, args: LVal[]) => {
			return new LValList([args[0], ...(args[1] as LValList).value]);
		}
	},
	{
		name: 'peek',
		arity: 1,
		params: [LValType.LIST],
		params_rest: [],
		call: (_interpreter: Interpreter, args: LVal[]) => {
			return (args[0] as LValList).value[0] ?? new LValNil();
		}
	},
	{
		name: 'pop',
		arity: 1,
		params: [LValType.LIST],
		params_rest: [],
		call: (_interpreter: Interpreter, args: LVal[], token: Token) => {
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
		call: (_interpreter: Interpreter, args: LVal[], token: Token) => {
			const list = (args[0] as LValList).value;
			const index = (args[1] as LValNumber).value;

			if (index < 0 || index >= list.length)
				throw new RuntimeError(token, `Index out of bounds!`);

			return list[index];
		}
	},
	{
		name: 'count',
		arity: 1,
		params: [LValType.LIST],
		params_rest: [],
		call: (_interpreter: Interpreter, args: LVal[]) => {
			return new LValNumber((args[0] as LValList).value.length);
		}
	}
];

export const native_funcs: NativeFunc[] = [
	...arithmetic_funcs,
	...logical_funcs,
	...io_funcs,
	...list_funcs
];
