import { BaseType, ComplexType } from './expr.ts';
import { Token } from './token.ts';

export type IRExpr = IRConst | IRTemp | IRCall | IRTag | IRUntag | IRESeq | IRFunc;
export type IRStmt = IRSeq | IRMove | IRJump | IRCJump | IRPhi | IRLabel | IRExp;
export type IRNode = IRExpr | IRStmt;

export class IRConst {
	value: unknown;

	constructor(value: unknown) {
		this.value = value;
	}

	toString() {
		return `${this.value}`;
	}
}

export class IRTemp {
	name: string;

	constructor(name: string) {
		this.name = name;
	}

	toString() {
		return this.name;
	}
}

export class IRLabel {
	name: string;

	constructor(name: string) {
		this.name = name;
	}

	toString() {
		return `${this.name}:`;
	}
}

export class IRCall {
	func: IRExpr;
	args: IRExpr[];

	constructor(func: IRExpr, args: IRExpr[]) {
		this.func = func;
		this.args = args;
	}

	toString(): string {
		return `call ${this.func.toString()}, ${this.args.map(arg => arg.toString()).join(', ')}`;
	}
}

// export class IRMem {
// 	location: IRExpr;

// 	constructor(location: IRExpr) {
// 		this.location = location;
// 	}

// 	toString(): string {
// 		return `[${this.location.toString()}]`;
// 	}
// }

export class IRTag {
	type: BaseType | ComplexType;
	value: IRExpr;

	constructor(type: BaseType | ComplexType, value: IRExpr) {
		this.type = type;
		this.value = value;
	}

	toString(): string {
		return `(tag ${this.value.toString()})`;
	}
}

export class IRUntag {
	value: IRExpr;

	constructor(value: IRExpr) {
		this.value = value;
	}

	toString(): string {
		return `(untag ${this.value.toString()})`;
	}
}

export class IRFunc {
	name: string;
	params: string[];
	body: IRExpr;
	captured_symbols: Token[];

	constructor(name: string, params: string[], body: IRExpr, captured_symbols: Token[]) {
		this.name = name;
		this.params = params;
		this.body = body;
		this.captured_symbols = captured_symbols;
	}

	toString(): string {
		return `${this.name}(${this.params.join(', ')}) => ${this.body.toString()}`;
	}
}

export class IRSeq {
	stmts: IRStmt[];

	constructor(insts: IRStmt[]) {
		this.stmts = insts;
	}

	toString(): string {
		return this.stmts.map(inst => inst.toString()).join('\n');
	}
}

export class IRExp {
	expr: IRExpr;

	constructor(expr: IRExpr) {
		this.expr = expr;
	}

	toString(): string {
		return this.expr.toString();
	}
}

export class IRESeq {
	expr: IRExpr;
	stmt: IRStmt;

	constructor(expr: IRExpr, stmt: IRStmt) {
		this.expr = expr;
		this.stmt = stmt;
	}

	toString(): string {
		return `{\n${this.stmt.toString()}\nret ${this.expr.toString()}\n}`;
	}
}

export class IRMove {
	source: IRExpr;
	dest: IRTemp;

	constructor(dest: IRTemp, source: IRExpr) {
		this.source = source;
		this.dest = dest;
	}

	toString(): string {
		return `${this.dest.toString()} = ${this.source.toString()}`;
	}
}

export class IRPhi {
	dest: IRExpr;
	predecs: { pre: IRLabel, source: IRExpr }[];

	constructor(dest: IRExpr, predecs: { pre: IRLabel, source: IRExpr }[]) {
		this.dest = dest;
		this.predecs = predecs;
	}

	toString() {
		return `phi ${this.dest}, ${this.predecs.map(({ pre, source }) => `[${pre.toString()} -> ${source.toString()}]`)}`;
	}
}

export class IRJump {
	target: IRLabel;

	constructor(target: IRLabel) {
		this.target = target;
	}

	toString() {
		return `jmp ${this.target.toString()}`;
	}
}

export class IRCJump {
	cond: IRExpr;
	true_branch: IRLabel;
	false_branch?: IRLabel;

	constructor(cond: IRExpr, true_branch: IRLabel, false_branch?: IRLabel) {
		this.cond = cond;
		this.true_branch = true_branch;
		this.false_branch = false_branch;
	}

	toString() {
		return `cjmp ${this.cond.toString()}, ${this.true_branch.toString()}${this.false_branch ? `, ${this.false_branch.toString()}` : ''}`;
	}
}

/* ----------------------------------------------------------------------- */

export type IRRVal = IRConst | IRTemp;
export type CIRExpr = IRRVal | CIRCall | CIRTag | CIRUntag | CIRESeq | CIRFunc;
export type CIRStmt = CIRSeq | CIRMove | IRJump | CIRCJump | IRPhi | IRLabel | CIRExp;
export type CIRNode = CIRExpr | CIRStmt;

export class CIRCall {
	func: IRRVal;
	args: IRRVal[];

	constructor(func: IRRVal, args: IRRVal[]) {
		this.func = func;
		this.args = args;
	}

	toString(): string {
		return `call ${this.func.toString()}, ${this.args.map(arg => arg.toString()).join(', ')}`;
	}
}

export class CIRTag {
	type: BaseType | ComplexType;
	value: IRRVal;

	constructor(type: BaseType | ComplexType, value: IRRVal) {
		this.type = type;
		this.value = value;
	}

	toString(): string {
		return `(tag ${this.value.toString()})`;
	}
}

export class CIRUntag {
	value: IRRVal;

	constructor(value: IRRVal) {
		this.value = value;
	}

	toString(): string {
		return `(untag ${this.value.toString()})`;
	}
}

export class CIRFunc {
	name: string;
	params: string[];
	body: CIRExpr;
	captured_symbols: Token[];

	constructor(name: string, params: string[], body: CIRExpr, captured_symbols: Token[]) {
		this.name = name;
		this.params = params;
		this.body = body;
		this.captured_symbols = captured_symbols;
	}

	toString(): string {
		return `${this.name}(${this.params.join(', ')}) => ${this.body.toString()}`;
	}
}

export class CIRSeq {
	stmts: CIRStmt[];

	constructor(insts: CIRStmt[]) {
		this.stmts = insts;
	}

	toString(): string {
		return this.stmts.map(inst => inst.toString()).join('\n');
	}
}

export class CIRExp {
	expr: CIRExpr;

	constructor(expr: CIRExpr) {
		this.expr = expr;
	}

	toString(): string {
		return this.expr.toString();
	}
}

export class CIRESeq {
	expr: IRRVal;
	stmt: CIRStmt;

	constructor(expr: IRRVal, stmt: CIRStmt) {
		this.expr = expr;
		this.stmt = stmt;
	}

	toString(): string {
		return `{\n${this.stmt.toString()}\nret ${this.expr.toString()}\n}`;
	}
}

export class CIRMove {
	source: CIRExpr;
	dest: IRTemp;

	constructor(dest: IRTemp, source: CIRExpr) {
		this.source = source;
		this.dest = dest;
	}

	toString(): string {
		return `${this.dest.toString()} = ${this.source.toString()}`;
	}
}

export class CIRCJump {
	cond: IRRVal;
	true_branch: IRLabel;
	false_branch?: IRLabel;

	constructor(cond: IRRVal, true_branch: IRLabel, false_branch?: IRLabel) {
		this.cond = cond;
		this.true_branch = true_branch;
		this.false_branch = false_branch;
	}

	toString() {
		return `cjmp ${this.cond.toString()}, ${this.true_branch.toString()}${this.false_branch ? `, ${this.false_branch.toString()}` : ''}`;
	}
}
