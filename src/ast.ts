import { ExprVisitor, LiteralExpr, ListExpr, OpExpr, IfExpr, LetExpr, LoopExpr, FnExpr } from './expr.ts';

const astPrinter: ExprVisitor<string> = {
	visitLiteral: (expr: LiteralExpr) =>
		`${expr.value}`,

	visitList: (expr: ListExpr) =>
		`(${expr.children.map(c => c.accept(astPrinter)).join(' ')})`,

	visitOp: (expr: OpExpr) =>
		`(${expr.op.lexeme} ${expr.children.map(c => c.accept(astPrinter)).join(' ')})`,

	visitIf: (expr: IfExpr) =>
		`(if ${expr.true_child.accept(astPrinter)} ${expr.true_child.accept(astPrinter)})`,

	visitLet: (expr: LetExpr) =>
		`(let [${expr.bindings.accept(astPrinter)}] ${expr.body.accept(astPrinter)})`,

	visitLoop: (expr: LoopExpr) =>
		`(loop [${expr.bindings.accept(astPrinter)}] ${expr.body.accept(astPrinter)})`,

	visitFn: (expr: FnExpr) =>
		`(fn ${expr.name?.lexeme ?? ''}[${expr.bindings.accept(astPrinter)}] ${expr.body.accept(astPrinter)})`
};
