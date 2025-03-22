import { Callable } from "./interpreter.ts";
import { Token } from "./token.ts";

export enum LValType {
	NUMBER = 'NUMBER', STRING = 'STRING', BOOLEAN = 'BOOLEAN', NIL = 'NIL',

	SYMBOL = 'SYMBOL', LIST = 'LIST', VECTOR = 'VECTOR', FUNCTION = 'FUNCTION', S = 'S',

	ANY = 'ANY',
}

export type LVal = LValNumber | LValString | LValBoolean | LValNil | LValSymbol | LValList | LValVector | LValFunction;

export class LValNumber {
	type = LValType.NUMBER;
	value: number;

	constructor(value: number) {
		this.value = value;
	}

	toString(): string {
		return `${this.value}`;
	}
}

export class LValString {
	type = LValType.STRING;
	value: string;

	constructor(value: string) {
		this.value = value;
	}

	toString(): string {
		return this.value;
	}
}

export class LValBoolean {
	type = LValType.BOOLEAN;
	value: boolean;

	constructor(value: boolean) {
		this.value = value;
	}

	toString(): string {
		return `${this.value}`;
	}
}

export class LValNil {
	type = LValType.NIL;
	value = null;

	toString(): string {
		return 'null';
	}
}

export class LValSymbol {
	type = LValType.SYMBOL;
	value: Token;

	constructor(value: Token) {
		this.value = value;
	}

	toString(): string {
		return this.value.lexeme;
	}
}

export class LValList {
	type = LValType.LIST;
	value: LVal[];
	l_paren?: Token;

	constructor(value: LVal[], l_paren?: Token) {
		this.value = value;
		this.l_paren = l_paren;
	}

	toString(): string {
		return `(${this.value.map(v => v.toString()).join(' ')})`;
	}
}

export class LValVector {
	type = LValType.VECTOR;
	value: LVal[];
	l_paren?: Token;

	constructor(value: LVal[], l_paren?: Token) {
		this.value = value;
		this.l_paren = l_paren;
	}

	toString(): string {
		return `[${this.value.map(v => v.toString()).join(' ')}]`;
	}
}

export class LValFunction {
	type = LValType.FUNCTION;
	name?: string;
	value: Callable;

	constructor(value: Callable, name?: string) {
		this.value = value;
		this.name = name;
	}

	toString(): string {
		return this.name !== undefined ? `<fn ${this.name}>` : '<fn anon>';
	}
}
