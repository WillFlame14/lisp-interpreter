import { Interpreter, truthy } from './interpreter.ts';
import { LVal, LValBoolean, LValNil, LValNumber, LValType } from './types.ts';

interface NativeFunc {
	name: string,
	arity: number;
	params: LValType[],
	call: (interpreter: Interpreter, args: LVal[]) => LVal;
}

export const native_funcs: NativeFunc[] = [
	{
		name: '+',
		arity: -1,
		params: [LValType.NUMBER],
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
		params: [LValType.NUMBER],
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
		params: [],
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
		call: (_interpreter: Interpreter, args: LVal[]) => {
			const a = (args[0] as LValNumber).value;
			const b = (args[1] as LValNumber).value;
			return new LValNumber(a % b);
		}
	},
	{
		name: 'or',
		arity: -1,
		params: [],
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
		call: (_interpreter: Interpreter, args: LVal[]) => {
			if (args.length === 0)
				return new LValBoolean(true);

			const first_falsey = args.find(arg => !truthy(arg));

			if (first_falsey !== undefined)
				return first_falsey;

			return args.at(-1) ?? new LValBoolean(true);
		}
	},
	{
		name: 'print',
		arity: -1,
		params: [],
		call: (_interpreter: Interpreter, args: LVal[]) => {
			for (const arg of args)
				console.log(JSON.stringify(arg));

			return new LValNil();
		}
	}
];
