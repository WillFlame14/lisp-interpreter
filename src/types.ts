import { Callable } from "./interpreter.ts";

export enum LValType {
	NUMBER = 'NUMBER', STRING = 'STRING', BOOLEAN = 'BOOLEAN', NIL = 'NIL',

	LIST = 'LIST', FUNCTION = 'FUNCTION'
}

export interface LVal {
	type: LValType;
	value: unknown;
}

export class LValNumber implements LVal {
	type = LValType.NUMBER;
	value: number;

	constructor(value: number) {
		this.value = value;
	}
}

export class LValString implements LVal {
	type = LValType.STRING;
	value: string;

	constructor(value: string) {
		this.value = value;
	}
}

export class LValBoolean implements LVal {
	type = LValType.BOOLEAN;
	value: boolean;

	constructor(value: boolean) {
		this.value = value;
	}
}

export class LValNil implements LVal {
	type = LValType.NIL;
	value = null;
}

export class LValList implements LVal {
	type = LValType.LIST;
	value: LVal[];

	constructor(value: LVal[]) {
		this.value = value;
	}
}

export class LValFunction implements LVal {
	type = LValType.FUNCTION;
	name?: string;
	value: Callable;

	constructor(value: Callable, name?: string) {
		this.value = value;
		this.name = name;
	}
}
