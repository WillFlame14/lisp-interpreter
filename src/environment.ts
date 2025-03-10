import { RuntimeError } from './interpreter.ts';
import { Token } from './token.ts';

export class Environment {
	enclosing?: Environment;
	symbolMap: Record<string, unknown> = {};

	constructor(enclosing?: Environment) {
		this.enclosing = enclosing;
	}

	define(key: string, value: unknown) {
		this.symbolMap[key] = value;
	}

	retrieve(key: Token): unknown {
		if (key.lexeme in this.symbolMap)
			return this.symbolMap[key.lexeme];

		if (this.enclosing !== undefined)
			return this.enclosing.retrieve(key);

		throw new RuntimeError(key, `Unable to resolve symbol ${key.lexeme}.`);
	}
}
