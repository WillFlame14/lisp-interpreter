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

const INTEGER_SHIFT = 2;
const encodeInt = (value: number) => value << INTEGER_SHIFT;
const isInt = (value: number) => (value & 0x11) === 0;
const decodeInt = (value: number) => value >> INTEGER_SHIFT;

const NULL = 0;

function format_mem(register: string, index: number) {
	if (index >= 0)
		return `[${register}-${4*(index + 1)}]`;

	return `[${register}+${-4*(index - 1)}]`;
}

class Translator {
	env = new TranslatorEnv();
	id = 0;

	asm: string[] = [];
	data: string[] = [];

	closure: string | undefined = undefined;

	getLabel() {
		this.id++;
		return `label_${this.id}`;
	}

	compile_literal(expr: LiteralExpr) {
		if (typeof expr.value === 'number') {
			this.asm.push(`mov eax, ${expr.value}`);
			return;
		}

		if (typeof expr.value === 'boolean') {
			this.asm.push(`mov eax, ${expr.value ? 1 : 0}`);
			return;
		}

		throw new Error();
	}

	compile_symbol(expr: SymbolExpr) {
		if (expr.name.lexeme in nativeMap) {
			this.asm.push(`mov eax, __${nativeMap[expr.name.lexeme as keyof typeof nativeMap]}`);
			return;
		}

		const entry = this.env.retrieve(expr.name);

		if (typeof entry === 'number')
			this.asm.push(`mov eax, ${format_mem('ebp', entry)}`);
		else
			this.asm.push(`mov eax, ${entry}`);
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
			this.asm.push('push eax');
		}

		for (let i = 0; i < expr.children.length; i++) {
			this.asm.push(
				'mov eax, 8',
				'call __allocate',
				...(i === 0 ? [] : ['pop ecx']),					// pop 'next' ptr into ecx
				'pop ebx',
				'mov [eax], ebx',									// value
				`mov [eax+4], ${i === 0 ? `word ${NULL}` : 'ecx'}`,	// next pointer (NULL if tail, otherwise ecx)
				'push eax'											// store 'next' on stack
			);
		}

		// Pointer to head of list is stored in eax
		this.asm.push('add esp, 4');
	}

	compile_s(expr: SExpr) {
		// Compute all args and push onto stack
		for (const child of expr.children) {
			this.compile_expr(child);
			this.asm.push('push eax');
		}

		// Determine function in eax, then call it
		this.compile_expr(expr.op);

		// Insert closure env as first parameter


		this.asm.push('call eax', `add esp, ${expr.children.length * 4}`);
	}

	compile_if(expr: IfExpr) {
		const label_true = this.getLabel();
		const label_after = this.getLabel();

		this.compile_expr(expr.cond);
		this.asm.push('cmp eax, 1', `je ${label_true}`);

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
			this.asm.push('push eax');
			nested.bind(key.lexeme, true);
		}

		try {
			this.compile_expr(expr.body);
			this.asm.push(`add esp, ${nested.local_vars * 4}`);
		}
		finally {
			this.env = enclosing;
		}
	}

	compile_fn(expr: FnExpr) {
		const label_after = this.getLabel();
		const label_fn = `USER_${expr.name === undefined ? `anon_${this.getLabel()}` : `named_${expr.name.lexeme}_${this.getLabel()}`}`;

		this.asm.push(
			`jmp ${label_after}`,
			`${label_fn}:`,
			'push ebp',
			'mov ebp, esp');

		const enclosing = this.env;
		const nested = new TranslatorEnv(enclosing);

		// Insert closure env as first parameter
		// const keys = Object.keys(enclosing.symbolMap);
		// for (let i = 0; i < keys.length; i++)
		// 	nested.define(keys[i], `${i}`);

		// nested.local_vars++;

		for (const token of expr.params.toReversed())
			nested.bind(token.lexeme, false);

		// Allow recursion
		if (expr.name !== undefined)
			nested.define(expr.name.lexeme, label_fn);

		this.data.push(`${label_fn}_closure:`, ...Object.entries(enclosing.symbolMap).map(([_, value]) => `dd ${value}`));

		try {
			this.env = nested;
			this.compile_expr(expr.body);
			this.asm.push(
				'pop ebp',
				'ret',
				`${label_after}:`,
				`mov eax, ${label_fn}`);
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
		'mov ebp, esp',
		'call __alloc_init',
		...translator.asm,
		'call __debexit',
		'',
		'section .data',
		...translator.data
	].join('\n');
}
