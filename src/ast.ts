import { ExprVisitor, LiteralExpr, SymbolExpr, SExpr, IfExpr, LetExpr, LoopExpr, FnExpr, QuoteExpr, ListExpr, RecurExpr } from './expr.ts';

export const astPrinter: ExprVisitor<string> = {
	visitLiteral: (expr: LiteralExpr) => `${typeof expr.value === 'string' ? `"${expr.value}"` : expr.value}`,

	visitSymbol: (expr: SymbolExpr) => expr.name.lexeme,

	visitList: (expr: ListExpr) =>
		`(${expr.children.map(c => c.accept(astPrinter)).join(' ')})`,

	visitSExpr: (expr: SExpr) =>
		`(${expr.children.map(c => c.accept(astPrinter)).join(' ')})`,

	// visitOp: (expr: OpExpr) =>
	// 	`(${expr.op.lexeme} ${expr.children.map(c => c.accept(astPrinter)).join(' ')})`,

	visitIf: (expr: IfExpr) =>
		`(if ${expr.cond.accept(astPrinter)} ${expr.true_child.accept(astPrinter)} ${expr.false_child.accept(astPrinter)})`,

	visitLet: (expr: LetExpr) =>
		`(let [${expr.bindings.map(b => `${b.key.lexeme} ${b.value.accept(astPrinter)}`).join(' ')}] ${expr.body.accept(astPrinter)})`,

	visitLoop: (expr: LoopExpr) =>
		`(loop [${expr.bindings.map(b => `${b.key.lexeme} ${b.value.accept(astPrinter)}`).join(' ')}] ${expr.body.accept(astPrinter)})`,

	visitRecur: (_expr: RecurExpr) => ``,

	visitFn: (expr: FnExpr) =>
		`(fn ${expr.name?.lexeme ?? ''}[${expr.params.map(p => p.lexeme).join(' ')}] ${expr.body.accept(astPrinter)})`,

	visitQuote: (expr: QuoteExpr) =>
		`(quote ${expr.body.accept(astPrinter)})`,
};
