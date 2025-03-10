import { astPrinter } from './ast.ts';
import { Environment } from './environment.ts';
import { Expr, ExprVisitor, LiteralExpr, NameExpr, ListExpr, IfExpr, LetExpr, LoopExpr, FnExpr, isExpr } from './expr.ts';
import { runtimeError } from './main.ts';
import { Token } from './token.ts';

export class RuntimeError extends Error {
	token: Token;

	constructor(token: Token, message: string) {
		super(message);
		this.token = token;
	}
}

function truthy (value: unknown) {
	return !(value === false || value === null);
}

class Callable {
	arity: number;
	call: (interpreter: Interpreter, args: unknown[]) => unknown;
	toString: string;

	constructor(arity: number, call: (interpreter: Interpreter, args: unknown[]) => unknown, toString: string) {
		this.arity = arity;
		this.call = call;
		this.toString = toString;
	}
}

export class Interpreter implements ExprVisitor<unknown> {
	globals = new Environment();
	env = this.globals;

	constructor() {
		this.globals.define('+', new Callable(
			-1,
			(_interpreter: Interpreter, args: unknown[]) => {
				let sum = 0;
				for (const arg of args)
					sum += arg as number;
				return sum;
			},
			'<native fn>'
		));

		this.globals.define('-', new Callable(
			-1,
			(_interpreter: Interpreter, args: unknown[]) => {
				let sum = args[0] as number;
				for (let i = 1; i < args.length; i++)
					sum -= args[i] as number;
				return sum;
			},
			'<native fn>'
		));

		this.globals.define('=', new Callable(
			-1,
			(_interpreter: Interpreter, args: unknown[]) => {
				let result = true;
				for (let i = 1; i < args.length; i++)
					result = args[0] === args[i];
				return result;
			},
			'<native fn>'
		));

		this.globals.define('mod', new Callable(
			2,
			(_interpreter: Interpreter, args: unknown[]) => {
				const a = args[0] as number;
				const b = args[1] as number;
				return a % b;
			},
			'<native fn>'
		));

		this.globals.define('print', new Callable(
			-1,
			(_interpreter: Interpreter, args: unknown[]) => {
				for (const arg of args)
					console.log(JSON.stringify(arg));
			},
			'<native fn>'
		));
	}

	evaluate(expr: Expr): unknown {
		return expr.accept(this);
	}

	visitLiteral(expr: LiteralExpr) {
		return expr.value;
	}

	visitName(expr: NameExpr) {
		const value = this.env.retrieve(expr.name);

		return isExpr(value) ? this.evaluate(value) : value;
	}

	visitList(expr: ListExpr) {
		if (expr.children.length === 0)
			throw new RuntimeError(expr.r_paren, 'Empty list in function invocation!');

		const func = this.evaluate(expr.children[0]);

		if (!(func instanceof Callable))
			throw new RuntimeError(expr.r_paren, `Unable to convert ${JSON.stringify(func)} to a function.`);

		const expected_arity = func.arity === -1 ? expr.children.length - 1 : func.arity;

		if (expected_arity !== expr.children.length - 1)
			throw new RuntimeError(expr.r_paren, `Function requires ${expected_arity} parameters, got ${expr.children.length - 1}.`);

		const args = expr.children.slice(1).map(child => this.evaluate(child));

		return func.call(this, args);
	}

	visitIf(expr: IfExpr) {
		return truthy(this.evaluate(expr.cond)) ? this.evaluate(expr.true_child) : this.evaluate(expr.false_child);
	}

	visitLet(expr: LetExpr) {
		const enclosing = this.env;
		const nested = new Environment(enclosing);

		for (const { key, value } of expr.bindings)
			nested.define(key.lexeme, value);

		try {
			this.env = nested;
			return this.evaluate(expr.body);
		}
		finally {
			this.env = enclosing;
		}
	}

	visitLoop(expr: LoopExpr){
		return undefined;
	}

	visitFn(expr: FnExpr) {
		const func = new Callable(
			expr.params.length,
			(interpreter: Interpreter, args: unknown[]) => {
				const enclosing = this.env;
				const nested = new Environment(enclosing);

				for (let i = 0; i < args.length; i++) {
					const param = expr.params[i].lexeme;
					nested.define(param, args[i]);
				}

				if (expr.name !== undefined)
					enclosing.define(expr.name.lexeme, func);

				try {
					interpreter.env = nested;
					return interpreter.evaluate(expr.body);
				}
				finally {
					interpreter.env = enclosing;
				}
			},
			expr.body.accept(astPrinter)
		);

		return func;
	}
}

export function interpret(program: Expr[]) {
	const interpreter = new Interpreter();

	try {
		for (const expr of program)
			console.log(interpreter.evaluate(expr));
	}
	catch (err) {
		if (err instanceof RuntimeError)
			runtimeError(err);
	}
	return;
}
