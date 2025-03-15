import { TranslatorEnv } from './environment.ts';
import { Expr, FnExpr, IfExpr, LetExpr, ListExpr, LiteralExpr, PrimaryExpr, QuoteExpr, SExpr, SymbolExpr } from './expr.ts';

const nativeMap = {
	'+': 'plus',
	'-': 'minus',
	'=': 'eq',
	peek: 'peek',
	pop: 'pop',
	nth: 'nth',
	cons: 'cons',
	count: 'count'
};

const IMMEDIATE_MASK = 0b111111;

const INT_MASK = 0b00;
const BOOL_MASK = 0b01;
const NIL_MASK = 0b10;
const CLOSURE_MASK = 0b11;

const encodeInt = (value: number) => value << 2;
const isInt = (value: number) => (value & 0b11) === INT_MASK;
const decodeInt = (value: number) => value >> 2;

const encodeBool = (value: boolean) => ((value ? 1 : 0) << 2) | 1;
const isBool = (value: number) => (value & 0b11) === BOOL_MASK;
const decodeBool = (value: number) => value >> 2;

const encodeClosure = (value: number) => value | 0b10;
const isClosure = (value: number) => (value & 0b11) === CLOSURE_MASK;

const NULL = 0;

function format_mem(register: string, index: number) {
	if (index >= 0)
		return `[${register}-${8*(index + 1)}]`;

	return `[${register}+${-8*(index - 1)}]`;
}

class Translator {
	env = new TranslatorEnv();
	id = 0;

	asm: string[] = [];
	data: string[] = [];

	defined_closure = false;
	closure: string | undefined = undefined;

	getId() {
		this.id++;
		return this.id;
	}

	compile_literal(expr: LiteralExpr) {
		if (typeof expr.value === 'number') {
			this.asm.push(`mov rax, ${expr.value}`);
			return;
		}

		if (typeof expr.value === 'boolean') {
			this.asm.push(`mov rax, ${expr.value ? 1 : 0}`);
			return;
		}

		throw new Error();
	}

	compile_symbol(expr: SymbolExpr) {
		if (expr.name.lexeme in nativeMap) {
			this.asm.push(`mov rax, __${nativeMap[expr.name.lexeme as keyof typeof nativeMap]}`);
			return;
		}

		const entry = this.env.retrieve(expr.name);

		if (typeof entry === 'number')
			this.asm.push(`mov rax, ${format_mem('rbp', entry)}`);
		else
			this.asm.push(`mov rax, ${entry}`);
	}

	compile_primary(expr: PrimaryExpr) {
		if (expr instanceof LiteralExpr)
			this.compile_literal(expr);
		else if (expr instanceof SymbolExpr)
			this.compile_symbol(expr);
		else
			this.compile_list(expr);
	}

	compile_list(expr: ListExpr) {
		for (const child of expr.children) {
			this.compile_primary(child);
			this.asm.push('push rax');
		}

		for (let i = 0; i < expr.children.length; i++) {
			this.asm.push(
				'mov rax, 8',
				'call __allocate',
				...(i === 0 ? [] : ['pop rcx']),					// pop 'next' ptr into rcx
				'pop rbx',
				'mov [rax], rbx',									// value
				`mov [rax+8], ${i === 0 ? `word ${NULL}` : 'rcx'}`,	// next pointer (NULL if tail, otherwise rcx)
				'push rax'											// store 'next' on stack
			);
		}

		// Pointer to head of list is stored in rax
		this.asm.push('add rsp, 8');
	}

	compile_s(expr: SExpr) {
		// Compute all args and push onto stack
		for (const child of expr.children) {
			this.compile_expr(child);
			this.asm.push('push rax');
		}

		// Determine function in rax, then call it
		this.compile_expr(expr.op);

		// Insert closure env as first parameter


		this.asm.push('call rax', `add rsp, ${expr.children.length * 8}`);
	}

	compile_if(expr: IfExpr) {
		const label_true = `label_${this.getId()}`;
		const label_after = `label_${this.getId()}`;

		this.compile_expr(expr.cond);
		this.asm.push('cmp rax, 1', `je ${label_true}`);

		this.compile_expr(expr.false_child);
		this.asm.push(`jmp ${label_after}`);

		this.asm.push(`${label_true}:`);
		this.compile_expr(expr.true_child);
		this.asm.push(`${label_after}:`);
	}

	compile_let(expr: LetExpr) {
		const enclosing = this.env;
		const nested = new TranslatorEnv(enclosing, true);

		this.env = nested;

		for (const { key, value } of expr.bindings) {
			this.compile_expr(value);
			this.asm.push('push rax');
			nested.bind(key.lexeme, true);

			if (this.defined_closure) {
				this.closure = key.lexeme;
				this.defined_closure = false;
			}
		}

		try {
			this.compile_expr(expr.body);
			this.asm.push(`add rsp, ${nested.local_vars * 8}`);
		}
		finally {
			this.env = enclosing;
		}
	}

	compile_fn(expr: FnExpr) {
		const label_after = `after_${this.getId()}`;
		const label_fn = expr.name === undefined ? `anon${this.getId()}` : `named${this.getId()}_${expr.name.lexeme}`;

		const enclosing = this.env;
		const nested = new TranslatorEnv(enclosing);

		this.data.push(`${label_fn}_closure:`, `dd ${label_fn}`, ...Object.keys(enclosing.symbolMap).map(_ => `dd 0`));
		this.defined_closure = true;

		this.asm.push(
			...Object.values(enclosing.symbolMap).map((value, i) =>
				`mov [${label_fn}_closure+${8*(i+1)}], ${typeof value === 'string' ? value : format_mem('rbp', value)}`),
			`jmp ${label_after}`,
			`${label_fn}:`,
			'push rbp',
			'mov rbp, rsp');

		// Insert closure env as first parameter
		const keys = Object.keys(enclosing.symbolMap);
		for (let i = 0; i < keys.length; i++)
			nested.define(keys[i], `${i}`);

		nested.local_vars++;

		for (const token of expr.params.toReversed())
			nested.bind(token.lexeme, false);

		// Allow recursion
		if (expr.name !== undefined)
			nested.define(expr.name.lexeme, `${label_fn}_closure`);

		try {
			this.env = nested;
			this.compile_expr(expr.body);
			this.asm.push(
				'pop rbp',
				'ret',
				`${label_after}:`,
				`mov rax, ${label_fn}_closure`);
		}
		finally {
			this.env = enclosing;
		}
	}

	compile_expr(expr: Expr) {
		if (expr instanceof LiteralExpr)
			this.compile_literal(expr);

		else if (expr instanceof SymbolExpr)
			this.compile_symbol(expr);

		else if (expr instanceof ListExpr)
			this.compile_list(expr);

		else if (expr instanceof SExpr)
			this.compile_s(expr);

		else if (expr instanceof IfExpr)
			this.compile_if(expr);

		else if (expr instanceof LetExpr)
			this.compile_let(expr);

		else if (expr instanceof FnExpr)
			this.compile_fn(expr);

		else if (expr instanceof QuoteExpr)
			this.compile_primary(expr.body);
		else
			throw new Error();
	}
}

function indent(s: string) {
	return !(s.endsWith(':') || s.startsWith('global') || s.startsWith('extern') || s.startsWith('section') || s.length === 0);
}

export function compile(program: Expr[]) {
	const translator = new Translator();

	for (const expr of program)
		translator.compile_expr(expr);

	return [
		'extern __alloc_init',
		'extern __allocate',
		'extern __deallocate',
		'extern __debexit',
		...Object.values(nativeMap).map(name => `extern __${name}`),
		'',
		'global _start',
		'_start:',
		'mov rbp, rsp',
		'call __alloc_init',
		...translator.asm,
		'call __debexit',
		'',
		'section .data',
		...translator.data
	].map(s => indent(s) ? `\t${s}` : s).join('\n');
}
