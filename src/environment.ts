import { RuntimeError } from './interpreter.ts';
import { Token } from './token.ts';
import { LVal } from './types.ts';

export class Environment {
	enclosing?: Environment;
	symbolMap: Record<string, LVal> = {};

	constructor(enclosing?: Environment) {
		this.enclosing = enclosing;
	}

	define(key: string, value: LVal) {
		this.symbolMap[key] = value;
	}

	retrieve(key: Token): LVal {
		if (key.lexeme in this.symbolMap)
			return this.symbolMap[key.lexeme];

		if (this.enclosing !== undefined)
			return this.enclosing.retrieve(key);

		throw new RuntimeError(key, `Unable to resolve symbol ${key.lexeme}.`);
	}
}
