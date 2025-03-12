import { Environment } from './environment.ts';
import { Expr, ExprVisitor, FnExpr, IfExpr, LetExpr, ListExpr, LiteralExpr, LoopExpr, QuoteExpr, RecurExpr, SExpr, SymbolExpr } from './expr.ts';
import { RuntimeError } from './interpreter.ts';
import { IRConst, IRExpr, IRStmt, IRTemp } from './ir.ts';

export class ExprTranslator implements ExprVisitor<IRExpr> {
	env = new Environment();

	evaluate(expr: Expr): IRExpr {
		return expr.accept(this);
	}

	visitLiteral(expr: LiteralExpr) {
		// if (typeof expr.value === 'string')
		// 	return new IRConst(expr.value);

		if (typeof expr.value === 'number')
			return new IRConst(expr.value);

		if (typeof expr.value === 'boolean')
			return new IRConst(expr.value ? 1 : 0);

		// if (expr.value === null)
		// 	return new LValNil();
	}

	visitSymbol(expr: SymbolExpr) {
		const value = this.env.retrieve(expr.name);

		return isExpr(value) ? this.evaluate(value) : new IRTemp(expr.name.lexeme);
	}

	visitList(expr: ListExpr) {

	}

	visitSExpr(expr: SExpr) {
		if (expr.children.length === 0)
			throw new RuntimeError(expr.r_paren, 'Empty s-expression!');

		const func = this.evaluate(expr.children[0]);
	}

	visitIf(expr: IfExpr) {

	}

	visitLet(expr: LetExpr) {

	}

	visitLoop(expr: LoopExpr) {

	}

	visitRecur(expr: RecurExpr) {

	}

	visitFn(expr: FnExpr) {

	}

	visitQuote(expr: QuoteExpr) {

	}
}