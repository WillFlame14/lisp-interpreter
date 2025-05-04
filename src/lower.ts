import { Environment } from './environment.ts';
import { BaseType, ComplexType, DoExpr, Expr, FnExpr, IfExpr, LetExpr, ListExpr, LoopExpr, PrimaryExpr, RecurExpr, SExpr, SymbolExpr, VectorExpr } from './expr.ts';
import { RuntimeError } from './interpreter.ts';
import { CIRCall, CIRCJump, CIRESeq, CIRMove, CIRSeq, CIRStmt, CIRTag, CIRUntag, IRCall, IRCJump, IRConst, IRESeq, IRExp, IRExpr, IRFunc, IRJump, IRLabel, IRMove, IRPhi, IRRVal, IRSeq, IRStmt, IRTag, IRTemp, IRUntag } from './ir.ts';
import { LValBoolean, LValNil, LValNumber, LValString } from './types.ts';

let counter = 0;

function getID() {
	counter++;
	return counter;
}

function lower_literal(_env: Environment<IRExpr>, expr: LValNumber | LValString | LValBoolean | LValNil): IRExpr {
	if (expr instanceof LValNumber)
		return new IRTag(BaseType.NUMBER, new IRConst(expr.value));

	if (expr instanceof LValBoolean)
		return new IRTag(BaseType.BOOLEAN, new IRConst(expr.value ? 1 : 0));

	if (expr instanceof LValString)
		return new IRTag(BaseType.STRING, new IRConst(expr.value));

	return new IRConst(0);
}

function lower_symbol(env: Environment<IRExpr>, expr: SymbolExpr): IRExpr {
	try {
		return env.retrieve(expr.name);
	}
	catch (err) {
		if (err instanceof RuntimeError) {
			console.log(`could not find ${expr.name.lexeme}, creating temp`);
			return new IRTemp(expr.name.lexeme);
		}

		throw err;
	}
}

export function lower_primary(env: Environment<IRExpr>, expr: PrimaryExpr): IRExpr {
	if (expr instanceof LValNumber || expr instanceof LValString || expr instanceof LValBoolean || expr instanceof LValNil)
		return lower_literal(env, expr);

	if (expr instanceof SymbolExpr)
		return lower_symbol(env, expr);

	if (expr instanceof ListExpr)
		return lower_list(env, expr);

	if (expr instanceof VectorExpr)
		return lower_vector(env, expr);

	return lower_fn(env, expr);
}

export function lower_list(env: Environment<IRExpr>, expr: ListExpr): IRExpr {
	if (expr.children.length === 0)
		return new IRConst(0);

	return new IRCall(new IRLabel('__make_list'), expr.children.map(child => lower_expr(env, child)));
}

export function lower_vector(env: Environment<IRExpr>, expr: VectorExpr): IRExpr {
	if (expr.children.length === 0)
		return new IRConst(0);

	return new IRCall(new IRLabel('__make_vector'), expr.children.map(child => lower_expr(env, child)));
}

export function lower_if(env: Environment<IRExpr>, expr: IfExpr): IRExpr {
	const id = getID();

	const true_label = new IRLabel(`true_${id}`);
	const false_label = new IRLabel(`false_${id}`);
	const after_label = new IRLabel(`after_${id}`);

	const true_temp = new IRTemp(`true_result_${id}`);
	const false_temp = new IRTemp(`false_result_${id}`);
	const result_temp = new IRTemp(`if_result_${id}`);

	return new IRESeq(result_temp, new IRSeq([
		new IRCJump(new IRUntag(lower_expr(env, expr.cond)), true_label),

		false_label,
		new IRMove(false_temp, lower_expr(env, expr.false_child)),
		new IRJump(after_label),

		true_label,
		new IRMove(true_temp, lower_expr(env, expr.true_child)),

		after_label,
		new IRPhi(result_temp, [
			{ pre: true_label, source: true_temp },
			{ pre: false_label, source: false_temp }
		])
	]));
}

export function lower_let(env: Environment<IRExpr>, expr: LetExpr): IRExpr {
	const id = getID();
	const nested = new Environment(env);
	const insts: IRStmt[] = [];

	const result_temp = new IRTemp(`t${id}`);

	for (const { key, value } of expr.bindings) {
		const key_temp = new IRTemp(`t${getID()}`);

		insts.push(new IRMove(key_temp, lower_expr(nested, value)));
		nested.define(key.lexeme, key_temp);
	}

	insts.push(new IRMove(result_temp, lower_expr(nested, expr.body)));

	return new IRESeq(result_temp, new IRSeq(insts));
}

export function lower_s(env: Environment<IRExpr>, expr: SExpr): IRExpr {
	const op = lower_expr(env, expr.op);

	return new IRCall(new IRUntag(op), expr.children.map(child => lower_expr(env, child)));
}

export function lower_fn(env: Environment<IRExpr>, expr: FnExpr): IRExpr {
	const id = getID();
	const name_label = new IRLabel(`${expr.name ? expr.name : 'anon'}_${id}`);

	const nested = new Environment(env);

	const { captured_symbols, params } = expr;

	if (expr.name !== undefined)
		nested.define(expr.name, name_label);

	return new IRTag(ComplexType.FUNCTION, new IRFunc(
		name_label.name,
		params.map(p => p.lexeme),
		lower_expr(nested, expr.body),
		captured_symbols));
}

export function lower_do(env: Environment<IRExpr>, expr: DoExpr): IRExpr {
	if (expr.bodies.length === 0)
		return new IRConst(0);

	return new IRESeq(
		lower_expr(env, expr.bodies.at(-1)!),
		new IRSeq(expr.bodies.slice(0, expr.bodies.length - 1).map(body => new IRExp(lower_expr(env, body)))));
}

export function lower_expr(env: Environment<IRExpr>, expr: Expr): IRExpr {
	if (expr instanceof LValNumber || expr instanceof LValString || expr instanceof LValBoolean || expr instanceof LValNil)
		return lower_literal(env, expr);

	if (expr instanceof SymbolExpr)
		return lower_symbol(env, expr);

	if (expr instanceof ListExpr)
		return lower_list(env, expr);

	if (expr instanceof VectorExpr)
		return lower_vector(env, expr);

	if (expr instanceof IfExpr)
		return lower_if(env, expr);

	if (expr instanceof LetExpr)
		return lower_let(env, expr);

	if (expr instanceof SExpr)
		return lower_s(env, expr);

	if (expr instanceof FnExpr)
		return lower_fn(env, expr);

	if (expr instanceof DoExpr)
		return lower_do(env, expr);

	if (expr instanceof LoopExpr)
		return new IRConst(0);

	if (expr instanceof RecurExpr)
		return new IRConst(0);

	return new IRConst(0);
}

export function lower(program: Expr[]) {
	const env = new Environment<IRExpr>();
	console.log('pre_canonical:');
	const exprs = program.map(expr => {
		const ir_expr = lower_expr(env, expr);
		console.log(ir_expr.toString());
		const { stmts, expr: canonical_expr } = canonicalize_expr(ir_expr);
		return new CIRESeq(canonical_expr, new CIRSeq(stmts));
	});
	console.log('-------');
	return exprs;
}

function isCanonicalRVal(ir: IRExpr) {
	return ir instanceof IRConst || ir instanceof IRTemp;
}

// function isCanonicalExpr(ir: IRExpr): boolean {
// 	if (ir instanceof IRConst || ir instanceof IRTemp)
// 		return true;

// 	if (ir instanceof IRTag || ir instanceof IRUntag)
// 		return isCanonicalRVal(ir.value);

// 	if (ir instanceof IRCall)
// 		return isCanonicalRVal(ir.func) && ir.args.every(isCanonicalRVal);

// 	if (ir instanceof IRESeq)
// 		return isCanonicalRVal(ir.expr) && isCanonicalStmt(ir.stmt);

// 	return isCanonicalExpr(ir.body);
// }

// function isCanonicalStmt(ir: IRStmt): boolean {
// 	if (ir instanceof IRLabel || ir instanceof IRPhi || ir instanceof IRJump)
// 		return true;

// 	if (ir instanceof IRSeq)
// 		return ir.stmts.every(stmt => isCanonicalStmt(stmt));

// 	if (ir instanceof IRExp)
// 		return isCanonicalExpr(ir.expr);

// 	if (ir instanceof IRMove)
// 		return isCanonicalRVal(ir.source);

// 	// CJump
// 	return isCanonicalRVal(ir.cond);
// }

function canonicalize_expr(ir: IRExpr): { stmts: CIRStmt[], expr: IRRVal } {
	if (ir instanceof IRConst || ir instanceof IRTemp)
		return { stmts: [], expr: ir };

	if (ir instanceof IRTag) {
		if (isCanonicalRVal(ir.value))
			return { stmts: [], expr: new CIRTag(ir.type, ir.value) };

		const { stmts, expr } = canonicalize_expr(ir.value);
		const result_temp = new IRTemp(`t${getID()}`);

		if (isCanonicalRVal(expr))
			return { stmts: stmts.concat(new CIRMove(result_temp, new CIRTag(ir.type, expr))), expr: result_temp };

		const expr_temp = new IRTemp(`t${getID()}`);
		return { stmts: stmts.concat(new CIRMove(expr_temp, expr), new CIRMove(result_temp, new CIRTag(ir.type, expr_temp))), expr: result_temp };
	}

	if (ir instanceof IRUntag) {
		if (isCanonicalRVal(ir.value))
			return { stmts: [], expr: new CIRUntag(ir.value) };

		const { stmts, expr } = canonicalize_expr(ir.value);
		const result_temp = new IRTemp(`t${getID()}`);

		if (isCanonicalRVal(expr))
			return { stmts: stmts.concat(new CIRMove(result_temp, new CIRUntag(expr))), expr: result_temp };

		const expr_temp = new IRTemp(`t${getID()}`);
		return { stmts: stmts.concat(new CIRMove(expr_temp, expr), new CIRMove(result_temp, new CIRUntag(expr_temp))), expr: result_temp };
	}

	if (ir instanceof IRCall) {
		const new_stmts: CIRStmt[] = [];
		const new_args: IRRVal[] = [];

		for (const arg of ir.args) {
			if (ir instanceof IRConst || ir instanceof IRTemp) {
				new_args.push(ir);
				continue;
			}

			const { stmts, expr } = canonicalize_expr(arg);
			const temp = new IRTemp(`t${getID()}`);
			new_stmts.push(...stmts, new CIRMove(temp, expr));
			new_args.push(temp);
		}

		const { stmts, expr } = canonicalize_expr(ir.func);
		const result_temp = new IRTemp(`t${getID()}`);

		if (isCanonicalRVal(expr))
			return { stmts: [...new_stmts, new CIRMove(result_temp, new CIRCall(expr, new_args))], expr: result_temp };

		const func_temp = new IRTemp(`t${getID()}`);

		return {
			stmts: [
				...new_stmts,
				...stmts,
				new CIRMove(func_temp, expr),
				new CIRMove(result_temp, new CIRCall(func_temp, new_args))
			],
			expr: result_temp
		};
	}

	if (ir instanceof IRESeq) {
		const { stmts, expr } = canonicalize_expr(ir.expr);
		return { stmts: [...canonicalize_stmt(ir.stmt), ...stmts], expr };
	}

	// IRFunc
	const { stmts, expr } = canonicalize_expr(ir.body);
	return { stmts: [], expr: new IRFunc(ir.name, ir.params, new CIRESeq(expr, new CIRSeq(stmts)), ir.captured_symbols) };
}

function canonicalize_stmt(ir: IRStmt): CIRStmt[] {
	if (ir instanceof IRLabel || ir instanceof IRPhi || ir instanceof IRJump)
		return [ir];

	if (ir instanceof IRSeq)
		return ir.stmts.flatMap(inst => canonicalize_stmt(inst));

	if (ir instanceof IRExp)
		return canonicalize_expr(ir.expr).stmts;

	if (ir instanceof IRMove) {
		const { stmts, expr } = canonicalize_expr(ir.source);

		if (isCanonicalRVal(expr))
			return stmts.concat(new CIRMove(ir.dest, expr));

		const temp = new IRTemp(`t${getID()}`);
		return [...stmts, new CIRMove(temp, expr), new CIRMove(ir.dest, temp)];
	}

	// CJump
	const { stmts, expr } = canonicalize_expr(ir.cond);
	return [...stmts, new CIRCJump(expr, ir.true_branch, ir.false_branch)];
}
