import { TEnvVar, TranslatorEnv, VarType } from './environment.ts';
import { LVal, LValBoolean, LValList, LValNil, LValNumber, LValString, LValSymbol, LValVector } from './types.ts';
import { argError, RuntimeError } from './interpreter.ts';

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
const LIST_MASK = 0b100;
const STRING_MASK = 0b101;

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

	compile_literal(expr: LValNumber | LValString | LValBoolean | LValNil) {
		if (expr instanceof LValNumber) {
			this.asm.push(`mov rax, ${(expr.value << 3) | INT_MASK}`);
			return;
		}

		if (expr instanceof LValBoolean) {
			this.asm.push(`mov rax, ${((expr.value ? 1 : 0) << 3) | BOOL_MASK}`);
			return;
		}

		if (expr instanceof LValString) {
			const string_label = `string${this.getId()}`;
			this.data.push(`dq ${expr.value.length}`, `${string_label}: dq "${expr.value}"`);
			this.asm.push(`mov rax, ${string_label}`, `call __toString`);
			return;
		}

		if (expr instanceof LValNil) {
			this.asm.push(`xor rax, rax`);
			return;
		}

		throw new Error();
	}

	compile_symbol(expr: LValSymbol) {
		if (expr.value.lexeme in nativeMap) {
			this.asm.push(`mov rax, __${nativeMap[expr.value.lexeme as keyof typeof nativeMap]}_closure`, `call __toClosure`);
			return;
		}

		const entry = this.env.retrieve(expr.value);
		this.asm.push(...get_mem('rax', entry));
	}

	compile_primary(expr: LVal) {
		if (expr instanceof LValNumber || expr instanceof LValString || expr instanceof LValBoolean || expr instanceof LValNil)
			this.compile_literal(expr);
		else if (expr instanceof LValSymbol)
			this.compile_symbol(expr);
		else if (expr instanceof LValVector)
			this.compile_vector(expr);
		else if (expr instanceof LValList)
			this.compile_list(expr);
	}

	compile_vector(expr: LValVector) {
		if (expr.value.length === 0) {
			this.asm.push(`mov rax, dword 4`);	// NULL is 0, with list tag 100
			return;
		}
	}

	compile_list(expr: LValList) {
		if (expr.value.length === 0) {
			this.asm.push(`mov rax, dword 4`);	// NULL is 0, with list tag 100
			return;
		}

		const save_reg_params = Math.min(4, this.env.tracker[VarType.PARAM] + (this.env.tracker[VarType.CLOSURE] > 0 ? 1 : 0));

		// Save first 4 register params if needed
		for (let i = 0; i < save_reg_params; i++)
			this.asm.push(`push ${REGISTER_PARAMS[i]}`);

		// Compute children and push onto stack
		for (const child of expr.value) {
			this.compile_primary(child);
			this.asm.push('push rax');
		}

		for (let i = 0; i < expr.value.length; i++) {
			this.asm.push(
				'mov rax, 16',
				'call __allocate',
				...(i === 0 ? [] : ['pop rcx']),					// pop 'next' ptr into rcx
				'pop rbx',
				'mov [rax], rbx',									// value
				`mov [rax+8], ${i === 0 ? `dword ${NULL}` : 'rcx'}`,	// next pointer (NULL if tail, otherwise rcx)
			);

			if (i < expr.value.length - 1)
				this.asm.push('push rax');											// store 'next' on stack
		}

		// Restore register params
		for (let i = 0; i < save_reg_params; i++)
			this.asm.push(`pop ${REGISTER_PARAMS[save_reg_params - i - 1]}`);

		// Pointer to head of list is stored in rax - add list tag
		this.asm.push('call __toList');
	}

	compile_s(op: LValSymbol | LValList, args: LVal[]) {
		const save_reg_params = 1 + Math.min(REGISTER_PARAMS.length - 1, this.env.tracker[VarType.PARAM] + (this.env.tracker[VarType.CLOSURE] > 0 ? 1 : 0));

		// Save first 4 register params if needed
		for (let i = 0; i < save_reg_params; i++)
			this.asm.push(`push ${REGISTER_PARAMS[i]}`);

		// Compute all args and push onto stack
		for (const arg of args) {
			this.compile_expr(arg);
			this.asm.push('push rax');
		}

		// Get closure in rax
		this.compile_expr(op);

		this.asm.push(
			'mov rbx, 7',
			'and rbx, rax',
			'cmp rbx, 3',
			'jne __error',		// confirm that rax holds a closure
		);

		// Pass closure as first param
		this.asm.push(`mov ${REGISTER_PARAMS[0]}, rax`);

		const reg_params = Math.min(REGISTER_PARAMS.length - 1, args.length);

		// Pop remaining arguments into the param registers (leave rest on stack)
		for (let i = 0; i < reg_params; i++)
			this.asm.push(`pop ${REGISTER_PARAMS[reg_params - i]}`);

		// Call function
		this.asm.push('call __removeTag', 'call [rax]');

		const stack_params = args.length - (REGISTER_PARAMS.length - 1);

		if (stack_params > 0)
			this.asm.push(`add rsp, ${stack_params * 8}`);

		// Restore register params
		for (let i = 0; i < save_reg_params; i++)
			this.asm.push(`pop ${REGISTER_PARAMS[save_reg_params - i - 1]}`);
	}

	compile_if(op: LValSymbol, args: LVal[]) {
		if (args.length < 2 || args.length > 3)
			throw argError(op, args);

		const [cond, true_child, false_child = new LValNil()] = args;
		const label_true = `label_${this.getId()}`;
		const label_after = `label_${this.getId()}`;

		this.compile_expr(cond);
		this.asm.push('cmp rax, 9', `je ${label_true}`);	// true is tagged 1001 (9 in decimal)

		this.compile_expr(false_child);
		this.asm.push(`jmp ${label_after}`);

		this.asm.push(`${label_true}:`);
		this.compile_expr(true_child);
		this.asm.push(`${label_after}:`);
	}

	compile_let(op: LValSymbol, args: LVal[]) {
		if (args.length !== 2)
			throw argError(op, args);

		const [bindings, body] = args;

		if (!(bindings instanceof LValVector) || bindings.value.length % 2 !== 0)
			throw new RuntimeError(op.value, 'Expected an even number of forms in bindings vector.');

		const enclosing = this.env;
		const nested = new TranslatorEnv(enclosing, true);

		this.env = nested;

		for (let i = 0; i < bindings.value.length; i += 2) {
			const symbol = bindings.value[i];
			const value = bindings.value[i + 1];

			if (!(symbol instanceof LValSymbol))
				throw new RuntimeError(op.value, 'Expected a symbol in bindings vector.');

			this.compile_expr(value);
			this.asm.push('push rax');
			nested.bind(symbol.value.lexeme, VarType.LOCAL);
		}

		try {
			this.compile_expr(body);
			this.asm.push(`add rsp, ${nested.tracker[VarType.LOCAL] * 8}`);
		}
		finally {
			this.env = enclosing;
		}
	}

	compile_fn(op: LValSymbol, args: LVal[]) {
		if (args.length < 2)
			throw argError(op, args);

		let name: LValSymbol | undefined;
		let params: LVal;
		let body: LVal;

		if (args[0] instanceof LValSymbol)
			[name, params, body] = args;
		else
			[params, body] = args;

		if (!(params instanceof LValVector) || !params.value.every(param => param instanceof LValSymbol))
			throw new RuntimeError(op.value, 'Expected a vector of symbols.');

		const label_after = `after_${this.getId()}`;
		const label_fn = name === undefined ? `anon${this.getId()}` : `named${this.getId()}_${name.value.lexeme}`;

		const enclosing = this.env;
		const nested = new TranslatorEnv(enclosing);

		this.data.push(`${label_fn}_closure:`, `dq ${label_fn}`, ...Object.keys(enclosing.symbolMap).map(_ => `dq 0`));

		this.asm.push(
			...Object.values(enclosing.symbolMap).flatMap((symbol, i) => {
				if (symbol.type === VarType.FUNC)
					return [`mov rax, ${symbol.label}`, `call __toClosure`, `mov [${label_fn}_closure+${8*(i+1)}], rax`];
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

		for (const token of params.value)
			nested.bind(token.value.lexeme, VarType.PARAM);

		// Allow recursion
		if (name !== undefined)
			nested.bind(name.value.lexeme, VarType.FUNC, `${label_fn}_closure`);

		try {
			this.env = nested;
			this.compile_expr(body);
			this.asm.push(
				'pop rbp',
				'ret',
				`${label_after}:`,
				`mov rax, ${label_fn}_closure`,
				`call __toClosure`
			);
		}
		finally {
			this.env = enclosing;
		}
	}

	compile_do(_op: LValSymbol, args: LVal[]) {
		if (args.length === 0) {
			this.asm.push('mov rax, 0');
			return;
		}

		for (const arg of args)
			this.compile_expr(arg);
	}

	compile_expr(expr: LVal) {
		if (expr instanceof LValNumber || expr instanceof LValString || expr instanceof LValBoolean || expr instanceof LValNil) {
			this.compile_literal(expr);
		}
		else if (expr instanceof LValSymbol) {
			this.compile_symbol(expr);
		}
		else if (expr instanceof LValVector) {
			this.compile_vector(expr);
		}
		else if (expr instanceof LValList) {
			const [op, ...args] = expr.value;

			if (op instanceof LValSymbol) {
				const name = op.value.lexeme;

				if (name === 'quote')
					this.compile_primary(args[0]);

				else if (name === 'if')
					this.compile_if(op, args);

				else if (name === 'fn')
					this.compile_fn(op, args);

				else if (name === 'let')
					this.compile_let(op, args);

				else if (name === 'do')
					this.compile_do(op, args);

				else
					this.compile_s(op, args);

				return;
			}
			else if (op instanceof LValList) {
				this.compile_s(op, args);
				return;
			}

			throw new Error(`Expected symbol, got ${JSON.stringify(op)}.`);
		}
	}
}

function indent(s: string) {
	return !(s.endsWith(':') || s.startsWith('global') || s.startsWith('extern') || s.startsWith('section') || s.length === 0);
}

export function compile(program: LVal[]) {
	const translator = new Translator();

	for (const expr of program)
		translator.compile_expr(expr);

	return [
		'extern __alloc_init',
		'extern __allocate',
		'extern __deallocate',
		'extern __debexit',
		'extern __error',
		'extern __exception',
		'extern __removeTag',
		'extern __toBool',
		'extern __toInt',
		'extern __toClosure',
		'extern __toList',
		'extern __toString',
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
