import { TranslatorEnv } from './environment.ts';
import { Expr, FnExpr, IfExpr, LetExpr, LiteralExpr, SExpr, SymbolExpr } from './expr.ts';

const nativeMap = {
	'+': 'plus',
	'-': 'minus',
	'=': 'eq'
};

function format_mem(register: string, index: number) {
	if (index >= 0)
		return `[${register}-${4*(index + 1)}]`;

	return `[${register}+${-4*(index - 1)}]`;
}

class Translator {
	env = new TranslatorEnv();
	id = 0;

	getLabel() {
		this.id++;
		return `label_${this.id}`;
	}

	compile_literal(expr: LiteralExpr) {
		if (typeof expr.value === 'number')
			return [`mov eax, ${expr.value}`];

		else if (typeof expr.value === 'boolean')
			return [`mov eax, ${expr.value ? 1 : 0}`];

		throw new Error();
	}

	compile_symbol(expr: SymbolExpr) {
		if (expr.name.lexeme in nativeMap)
			return [`mov eax, ${nativeMap[expr.name.lexeme as keyof typeof nativeMap]}`];

		const index = this.env.retrieve(expr.name);
		return [`mov eax, ${format_mem('ebp', index)}`];
	}

	compile_s(expr: SExpr) {
		let asm: string[] = [];

		// Compute all args and push onto stack
		for (const child of expr.children)
			asm = asm.concat([...this.compile_expr(child), 'push eax']);

		// Determine function in eax, then call it
		return asm.concat([...this.compile_expr(expr.op), 'call eax', `add esp, ${expr.children.length * 4}`]);
	}

	compile_if(expr: IfExpr) {
		let asm: string[] = [];

		const label_true = this.getLabel();
		const label_after = this.getLabel();

		asm = asm.concat([...this.compile_expr(expr.cond), 'cmp eax, 1', `je ${label_true}`]);

		asm = asm.concat([...this.compile_expr(expr.false_child), `jmp ${label_after}`]);

		asm = asm.concat([`${label_true}:`, ...this.compile_expr(expr.true_child), `${label_after}:`]);

		return asm;
	}

	compile_let(expr: LetExpr) {
		let asm: string[] = [];

		const enclosing = this.env;
		const nested = new TranslatorEnv(enclosing);

		for (const { key, value } of expr.bindings) {
			asm = asm.concat([...this.compile_expr(value), 'push eax']);
			nested.bind(key.lexeme, true);
		}

		try {
			this.env = nested;
			return asm.concat([...this.compile_expr(expr.body), `add esp, ${nested.local_vars * 4}`]);
		}
		finally {
			this.env = enclosing;
		}
	}

	compile_fn(expr: FnExpr) {
		const label_after = this.getLabel();
		const label_fn = `USER_${expr.name === undefined ? `anon_${this.getLabel()}` : `named_${expr.name.lexeme}_${this.getLabel()}`}`;
		let asm = [`jmp ${label_after}`, `${label_fn}:`, 'push ebp', 'mov ebp, esp'];

		const enclosing = this.env;
		const nested = new TranslatorEnv(enclosing);

		for (const token of expr.params)
			nested.bind(token.lexeme, false);

		// if (expr.name !== undefined) {
			// asm = [`push ${label_fn}`, ...asm];
			// enclosing.bind(expr.name.lexeme, true);
		// }

		try {
			this.env = nested;
			return asm.concat([...this.compile_expr(expr.body), 'pop ebp', 'ret', `${label_after}:`, `mov eax, ${label_fn}`]);
		}
		finally {
			this.env = enclosing;
		}
	}

	compile_expr(expr: Expr): string[] {
		if (expr instanceof LiteralExpr)
			return this.compile_literal(expr);

		if (expr instanceof SymbolExpr)
			return this.compile_symbol(expr);

		if (expr instanceof SExpr)
			return this.compile_s(expr);

		if (expr instanceof IfExpr)
			return this.compile_if(expr);

		if (expr instanceof LetExpr)
			return this.compile_let(expr);

		if (expr instanceof FnExpr)
			return this.compile_fn(expr);

		throw new Error();
	}
}

export function compile(program: Expr[]) {
	const translator = new Translator();

	const prelude = ['global _start', '_start:', 'mov ebp, esp'];
	const coda = ['mov ebx, eax', 'mov eax, 1','int 0x80'];

	return [...prelude, ...(program.flatMap(expr => translator.compile_expr(expr))), ...coda].join('\n');
}
