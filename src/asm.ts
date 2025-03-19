import { astPrinter } from './ast.ts';
import { TEnvVar, TranslatorEnv, VarType } from './environment.ts';
import { Expr, FnExpr, IfExpr, LetExpr, ListExpr, LiteralExpr, PrimaryExpr, QuoteExpr, SExpr, SymbolExpr } from './expr.ts';

const nativeMap = {
	'+': 'plus',
	'-': 'minus',
	'=': 'eq',
	peek: 'peek',
	pop: 'pop',
	nth: 'nth',
	cons: 'cons',
	count: 'count',
	print: 'print'
};

const TAG_MASK = 0b111;

const NIL_MASK = 0b000;
const BOOL_MASK = 0b001;
const INT_MASK = 0b010;
const CLOSURE_MASK = 0b011;

const NULL = 0;

const REGISTER_PARAMS = ['rdi', 'rsi', 'rdx', 'rcx', 'r8', 'r9'] as const;

function format_mem(register: string, index: number) {
	if (index >= 0)
		return `[${register}-${8*(index + 1)}]`;

	return `[${register}+${-8*(index - 1)}]`;
}

function get_mem(register: string, value: TEnvVar) {
	switch (value.type) {
		case VarType.LOCAL:
			return [`mov ${register}, [rbp-${8*(value.index + 1)}]`];

		case VarType.PARAM:
			if (value.index <= 5)	// param stored in register (but closure is always first param)
				return [`mov ${register}, ${REGISTER_PARAMS[value.index + 1]}`];

			// Need an extra offset to start at beginning of value
			return [`mov ${register}, [rbp+${8*(value.index + 2 - 6)}]`];

		case VarType.CLOSURE:
			// Need an extra offset since function is always first var in closure
			return [`mov rax, rdi`, `call __removeTag`, `mov ${register}, [rax+${8*(value.index + 1)}]`];

		case VarType.FUNC:
			// apply closure tag
			return [`mov ${register}, ${value.label}`, `or ${register}, 3`];
	}
}

class Translator {
	env = new TranslatorEnv();
	id = 0;

	asm: string[] = [];
	data: string[] = [];

	getId() {
		this.id++;
		return this.id;
	}

	compile_literal(expr: LiteralExpr) {
		if (typeof expr.value === 'number') {
			this.asm.push(`mov rax, ${(expr.value << 3) | INT_MASK}`);
			return;
		}

		if (typeof expr.value === 'boolean') {
			this.asm.push(`mov rax, ${((expr.value ? 1 : 0) << 3) | BOOL_MASK}`);
			return;
		}

		throw new Error();
	}

	compile_symbol(expr: SymbolExpr) {
		if (expr.name.lexeme in nativeMap) {
			this.asm.push(`mov rax, __${nativeMap[expr.name.lexeme as keyof typeof nativeMap]}_closure`, `or rax, 3`);
			return;
		}

		const entry = this.env.retrieve(expr.name);
		this.asm.push(...get_mem('rax', entry));
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
		if (expr.children.length === 0) {
			this.asm.push(`mov rax, dword ${NULL}`);
			return;
		}

		const save_reg_params = Math.min(4, this.env.tracker[VarType.PARAM] + (this.env.tracker[VarType.CLOSURE] > 0 ? 1 : 0));

		// Save first 4 register params if needed
		for (let i = 0; i < save_reg_params; i++)
			this.asm.push(`push ${REGISTER_PARAMS[i]}`);

		// Compute children and push onto stack
		for (const child of expr.children) {
			this.compile_primary(child);
			this.asm.push('push rax');
		}

		for (let i = 0; i < expr.children.length; i++) {
			this.asm.push(
				'mov rax, 16',
				'call __allocate',
				...(i === 0 ? [] : ['pop rcx']),					// pop 'next' ptr into rcx
				'pop rbx',
				'mov [rax], rbx',									// value
				`mov [rax+8], ${i === 0 ? `dword ${NULL}` : 'rcx'}`,	// next pointer (NULL if tail, otherwise rcx)
			);

			if (i < expr.children.length - 1)
				this.asm.push('push rax');											// store 'next' on stack
		}

		// Restore register params
		for (let i = 0; i < save_reg_params; i++)
			this.asm.push(`pop ${REGISTER_PARAMS[save_reg_params - i - 1]}`);

		// Pointer to head of list is stored in rax
	}

	compile_s(expr: SExpr) {
		const save_reg_params = 1 + Math.min(REGISTER_PARAMS.length - 1, this.env.tracker[VarType.PARAM] + (this.env.tracker[VarType.CLOSURE] > 0 ? 1 : 0));

		// Save first 4 register params if needed
		for (let i = 0; i < save_reg_params; i++)
			this.asm.push(`push ${REGISTER_PARAMS[i]}`);

		// Compute all args and push onto stack
		for (const child of expr.children) {
			this.compile_expr(child);
			this.asm.push('push rax');
		}

		// Get closure in rax
		this.compile_expr(expr.op);

		// this.asm.push(
		// 	'mov rbx, 7',
		// 	'and rbx, rax',
		// 	'cmp rbx, 3',
		// 	'jne __error',		// confirm that rax holds a closure
		// );

		// Pass closure as first param
		this.asm.push(`mov ${REGISTER_PARAMS[0]}, rax`);

		const reg_params = Math.min(REGISTER_PARAMS.length - 1, expr.children.length);

		// Pop remaining arguments into the param registers (leave rest on stack)
		for (let i = 0; i < reg_params; i++)
			this.asm.push(`pop ${REGISTER_PARAMS[reg_params - i]}`);

		// Call function
		this.asm.push('call __removeTag', 'call [rax]');

		const stack_params = expr.children.length - (REGISTER_PARAMS.length - 1);

		if (stack_params > 0)
			this.asm.push(`add rsp, ${stack_params * 8}`);

		// Restore register params
		for (let i = 0; i < save_reg_params; i++)
			this.asm.push(`pop ${REGISTER_PARAMS[save_reg_params - i - 1]}`);
	}

	compile_if(expr: IfExpr) {
		const label_true = `label_${this.getId()}`;
		const label_after = `label_${this.getId()}`;

		this.compile_expr(expr.cond);
		this.asm.push('cmp rax, 9', `je ${label_true}`);	// true is tagged 1001 (9 in decimal)

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
			nested.bind(key.lexeme, VarType.LOCAL);
		}

		try {
			this.compile_expr(expr.body);
			this.asm.push(`add rsp, ${nested.tracker[VarType.LOCAL] * 8}`);
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

		this.data.push(`${label_fn}_closure:`, `dq ${label_fn}`, ...Object.keys(enclosing.symbolMap).map(_ => `dq 0`));

		this.asm.push(
			...Object.values(enclosing.symbolMap).flatMap((symbol, i) => {
				if (symbol.type === VarType.FUNC)
					return [`mov rax, ${symbol.label}`, `or rax, 3`, `mov [${label_fn}_closure+${8*(i+1)}], rax`];
				else
					return [`mov rax, ${format_mem('rbp', symbol.index)}`, `mov [${label_fn}_closure+${8*(i+1)}], rax`];
			}),
			`jmp ${label_after}`,
			`${label_fn}:`,
			'push rbp',
			'mov rbp, rsp');

		// Set up closure vars
		for (const key of Object.keys(enclosing.symbolMap))
			nested.bind(key, VarType.CLOSURE);

		for (const token of expr.params)
			nested.bind(token.lexeme, VarType.PARAM);

		// Allow recursion
		if (expr.name !== undefined)
			nested.bind(expr.name.lexeme, VarType.FUNC, `${label_fn}_closure`);

		try {
			this.env = nested;
			this.compile_expr(expr.body);
			this.asm.push(
				'pop rbp',
				'ret',
				`${label_after}:`,
				`mov rax, ${label_fn}_closure`,
				`or rax, 3`
			);
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
		'extern __error',
		'extern __removeTag',
		...Object.values(nativeMap).map(name => `extern __${name}_closure`),
		'',
		'global _start',
		'_start:',
		'mov rbp, rsp',
		'call __alloc_init',
		...translator.asm,
		'call __debexit',
		'',
		'section .data',
		'ALIGN 8',
		...translator.data
	].map(s => indent(s) ? `\t${s}` : s).join('\n');
}
