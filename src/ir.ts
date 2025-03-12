enum OpType {
	PLUS = 'PLUS', MINUS = 'MINUS', STAR = 'STAR', SLASH = 'SLASH',
	EQ = 'EQ', GT = 'GT', LT = 'LT',
	AND = 'AND', OR = 'OR', NOT = 'NOT'
}

export type IRExpr = IRConst | IRTemp | IROp | IRMem | IRCall | IRName | IRESeq;
export type IRStmt = IRMove | IRSeq | IRJump | IRCJump | IRLabel | IRReturn;

export class IRConst {
	value: unknown;

	constructor(value: unknown) {
		this.value = value;
	}
}

export class IRTemp {
	name: string;

	constructor (name: string) {
		this.name = name;
	}
}

export class IROp {
	op: OpType;
	left: IRExpr;
	right: IRExpr;

	constructor (op: OpType, left: IRExpr, right: IRExpr) {
		this.op = op;
		this.left = left;
		this.right = right;
	}
}

export class IRMem {
	loc: IRExpr;

	constructor (loc: IRExpr) {
		this.loc = loc;
	}
}

export class IRCall {
	func: IRExpr;
	args: IRExpr[]

	constructor (func: IRExpr, args: IRExpr[]) {
		this.func = func;
		this.args = args;
	}
}

export class IRName {
	label: string;

	constructor (label: string) {
		this.label = label;
	}
}

export class IRESeq {
	stmt: IRStmt;
	expr: IRExpr;

	constructor (stmt: IRStmt, expr: IRExpr) {
		this.stmt = stmt;
		this.expr = expr;
	}
}

export class IRMove {
	dest: IRTemp | IRMem;
	source: IRExpr;

	constructor (dest: IRTemp | IRMem, source: IRExpr) {
		this.dest = dest;
		this.source = source;
	}
}

export class IRSeq {
	stmts: IRStmt[];

	constructor (stmts: IRStmt[]) {
		this.stmts = stmts;
	}
}

export class IRJump {
	target: IRExpr;

	constructor (target: IRExpr) {
		this.target = target;
	}
}

export class IRCJump {
	cond: IRExpr;
	true_branch: IRLabel;
	false_branch: IRLabel;

	constructor (cond: IRExpr, true_branch: IRLabel, false_branch: IRLabel) {
		this.cond = cond;
		this.true_branch = true_branch;
		this.false_branch = false_branch;
	}
}

export class IRLabel {
	name: string;

	constructor (name: string) {
		this.name = name;
	}
}

export class IRReturn {
	value: IRExpr;

	constructor (value: IRExpr) {
		this.value = value;
	}
}
