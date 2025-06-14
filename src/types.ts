import { Token } from './token.ts';
import { BaseType, ComplexType, ExprType, IExpr, } from './expr.ts';
import { Callable } from './interpreter.ts';

export type LVal = LValNumber | LValString | LValBoolean | LValNil | LValSymbol | LValList | LValVector;

export class LValNumber implements IExpr {
	readonly type = BaseType.NUMBER;
	readonly return_type = { type: BaseType.NUMBER };
	readonly captured_symbols: Token[] = [];
	value: number;

	constructor(value: number) {
		this.value = value;
	}

	toString(): string {
		return `${this.value}`;
	}
}

export class LValString implements IExpr {
	readonly type = BaseType.STRING;
	readonly return_type = { type: BaseType.STRING };
	readonly captured_symbols: Token[] = [];
	value: string;

	constructor(value: string) {
		this.value = value;
	}

	toString(): string {
		return this.value;
	}
}

export class LValBoolean implements IExpr {
	readonly type = BaseType.BOOLEAN;
	readonly return_type = { type: BaseType.BOOLEAN };
	readonly captured_symbols: Token[] = [];
	value: boolean;

	constructor(value: boolean) {
		this.value = value;
	}

	toString(): string {
		return `${this.value}`;
	}
}

export class LValNil implements IExpr {
	readonly type = BaseType.NIL;
	readonly return_type = { type: BaseType.NIL };
	readonly captured_symbols: Token[] = [];
	readonly value = null;

	toString(): string {
		return 'nil';
	}
}

export class LValSymbol {
	readonly type = BaseType.SYMBOL;
	value: Token;

	constructor(value: Token) {
		this.value = value;
	}

	toString(): string {
		return this.value.lexeme;
	}
}

export class LValList {
	readonly type = BaseType.LIST;
	value: LVal[];
	l_paren: Token;

	constructor(value: LVal[], l_paren: Token) {
		this.value = value;
		this.l_paren = l_paren;
	}

	toString(): string {
		return `(${this.value.map(v => v.toString()).join(' ')})`;
	}
}

export class LValVector {
	readonly type = BaseType.VECTOR;
	value: LVal[];
	l_paren: Token;

	constructor(value: LVal[], l_paren: Token) {
		this.value = value;
		this.l_paren = l_paren;
	}

	toString(): string {
		return `[${this.value.map(v => v.toString()).join(' ')}]`;
	}
}

export function logRuntimeVal(val: RuntimeVal): string {
	switch(val.type) {
		case BaseType.NUMBER:
		case BaseType.STRING:
		case BaseType.BOOLEAN:
			return val.value.toString();

		case BaseType.NIL:
			return 'nil';

		case BaseType.SYMBOL:
			return val.value.lexeme;

		case BaseType.LIST:
			return `(${val.value.map(logRuntimeVal).join(' ')})`;

		case BaseType.VECTOR:
			return `[${val.value.map(logRuntimeVal).join(' ')}]`;

		case ComplexType.FUNCTION:
			return `<function ${val.name}>`;
	}
}

export type RuntimeVal = RuntimeNumber | RuntimeString | RuntimeBoolean | RuntimeNil | RuntimeSymbol | RuntimeList | RuntimeVector | RuntimeFunction;

export type RuntimeNumber = {
	type: BaseType.NUMBER,
	value: number
};

export type RuntimeString = {
	type: BaseType.STRING,
	value: string
}

export type RuntimeBoolean = {
	type: BaseType.BOOLEAN,
	value: boolean
}

export type RuntimeNil = {
	type: BaseType.NIL,
	value: null
}

export type RuntimeSymbol = {
	type: BaseType.SYMBOL,
	value: Token
};

export type RuntimeList = {
	type: BaseType.LIST,
	value: RuntimeVal[]
}

export type RuntimeVector = {
	type: BaseType.VECTOR,
	value: RuntimeVal[]
}

export type RuntimeFunction = {
	type: ComplexType.FUNCTION,
	name?: string,
	params: ExprType[],
	params_rest?: ExprType,
	return_type: ExprType
	value: Callable
};
