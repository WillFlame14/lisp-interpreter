import { RuntimeError } from './interpreter.ts';
import { Token } from './token.ts';

export class Environment<T> {
	enclosing?: Environment<T>;
	symbolMap: Record<string, T> = {};

	constructor(enclosing?: Environment<T>) {
		this.enclosing = enclosing;
	}

	define(key: string, value: T) {
		this.symbolMap[key] = value;
	}

	retrieve(key: Token): T {
		if (key.lexeme in this.symbolMap)
			return this.symbolMap[key.lexeme];

		if (this.enclosing !== undefined)
			return this.enclosing.retrieve(key);

		throw new RuntimeError(key, `Unable to resolve symbol ${key.lexeme}.`);
	}
}

export enum VarType {
	LOCAL = 'LOCAL', PARAM = 'PARAM', CLOSURE = 'CLOSURE', FUNC = 'FUNC'
}

export type TEnvVar = { type: VarType.LOCAL, index: number } |
			{ type: VarType.PARAM, index: number } |
			{ type: VarType.CLOSURE, index: number } |
			{ type: VarType.FUNC, label: string };

export class TranslatorEnv extends Environment<TEnvVar> {
	tracker = {
		[VarType.LOCAL]: 0,
		[VarType.PARAM]: 0,
		[VarType.CLOSURE]: 0
	};

	bind(key: string, type: VarType, label?: string) {
		if (type === VarType.FUNC) {
			if (label === undefined)
				throw new Error('Cannot bind env function without label!');

			this.symbolMap[key] = { type, label: label };
			return;
		}

		const index = this.tracker[type];
		this.symbolMap[key] = { type, index };
		this.tracker[type]++;
	}
}
