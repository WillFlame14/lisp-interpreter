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

export class TranslatorEnv extends Environment<number | string> {
	local_vars = 0;
	params = -1;

	bind(key: string, local: boolean) {
		const index = local ? this.local_vars : this.params;
		this.symbolMap[key] = index;

		if (local)
			this.local_vars++;
		else
			this.params--;
	}
}
