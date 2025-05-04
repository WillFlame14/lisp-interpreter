import { CIRCall, CIRCJump, CIRESeq, CIRExp, CIRExpr, CIRFunc, CIRMove, CIRSeq, CIRStmt, CIRTag, CIRUntag, IRConst, IRJump, IRLabel, IRPhi, IRRVal, IRTemp } from './ir.ts';

function replace<A extends IRRVal>(ir: A, replacements: Record<string, IRTemp>): A {
	if (ir instanceof IRConst)
		return ir;

	return ir.name in replacements ? replacements[ir.name] as A : ir;
}

function oi_expr(ir: CIRExpr, replacements: Record<string, IRTemp>): CIRExpr {
	if (ir instanceof IRConst)
		return ir;

	if (ir instanceof IRTemp)
		return replace(ir, replacements);

	if (ir instanceof CIRCall) {
		console.log('ircall', ir.toString(), ir.args, replacements);
		return new CIRCall(replace(ir.func, replacements), ir.args.map(arg => replace(arg, replacements)));
	}

	if (ir instanceof CIRTag)
		return new CIRTag(ir.type, replace(ir.value, replacements));

	if (ir instanceof CIRUntag)
		return new CIRUntag(replace(ir.value, replacements));

	if (ir instanceof CIRESeq) {
		const stmt = oi_stmt(ir.stmt, replacements);
		const expr = replace(ir.expr, replacements);

		return stmt === undefined ? expr : new CIRESeq(expr, stmt);
	}

	// CIRFunc
	return new CIRFunc(ir.name, ir.params, oi_expr(ir.body, replacements), ir.captured_symbols);
}

function oi_stmt(ir: CIRStmt, replacements: Record<string, IRTemp>): CIRStmt | undefined {
	if (ir instanceof CIRMove) {
		if (ir.source instanceof IRTemp && ir.dest instanceof IRTemp && ir.dest.name.match(/t\d+/)) {
			console.log('replaceable', ir.toString());
			replacements[ir.dest.name] = replace(ir.source, replacements);
			return;
		}

		return new CIRMove(ir.dest, oi_expr(ir.source, replacements));
	}

	if (ir instanceof CIRSeq)
		return new CIRSeq(ir.stmts.map(stmt => oi_stmt(stmt, replacements)).filter(i => i !== undefined));

	if (ir instanceof IRLabel || ir instanceof IRJump)
		return ir;

	if (ir instanceof IRPhi) {
		return new IRPhi(ir.dest, ir.predecs.map(p =>
			p.source instanceof IRTemp ? { source: replace(p.source, replacements), pre: p.pre } : p));
	}

	if (ir instanceof CIRExp)
		return new CIRExp(oi_expr(ir.expr, replacements));

	// IRCJump
	return new CIRCJump(replace(ir.cond, replacements), ir.true_branch, ir.false_branch);
}

export function optimize_intermediates(program: CIRExpr[]) {
	const replacements: Record<string, IRTemp> = {};

	return program.map(ir => oi_expr(ir, replacements));
}
