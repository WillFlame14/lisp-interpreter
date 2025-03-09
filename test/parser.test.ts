import { expect, describe, it } from 'bun:test';

import { scanTokens } from '../src/scanner.ts';
import { parse_expr } from '../src/parser.ts';
import { FnExpr, LetExpr, IfExpr, ListExpr } from '../src/expr.ts';

describe('basic parsing', () => {
	it('parses a list literal', () => {
		const str = '(3 1 4 1)';

		const { expr } = parse_expr(scanTokens(str));
		expect(expr).toBeInstanceOf(ListExpr);
	});

	it('parses an operator expression', () => {
		const str = '(+ 2 3)';

		const { expr, rest } = parse_expr(scanTokens(str));

		expect(rest).toBeEmpty();
		expect(expr).toBeInstanceOf(ListExpr);
	});

	it('parses a named operator expression', () => {
		const str = '(print "Hello world!")';

		const { expr, rest } = parse_expr(scanTokens(str));

		expect(rest).toBeEmpty();
		expect(expr).toBeInstanceOf(ListExpr);
	});

	it('parses a nested list literal', () => {
		const str = '(3 1 (- (* 2 2) (/ 6 (+ 5 2))) 1)';

		const { expr } = parse_expr(scanTokens(str));
		expect(expr).toBeInstanceOf(ListExpr);
	});

	it('parses an if expression', () => {
		const str = '(if (= 4 5) 2 5)';

		const { expr } = parse_expr(scanTokens(str));
		expect(expr).toBeInstanceOf(IfExpr);
	});

	it('fails to parse an if expression without a false child', () => {
		const str = '(if true 2)';

		expect(() => parse_expr(scanTokens(str))).toThrow();
	});

	it('fails to parse an if expression with too many children', () => {
		const str = '(if true 2 6 8)';

		expect(() => parse_expr(scanTokens(str))).toThrow();
	});

	it('parses a let expression', () => {
		const str = '(let [x 2] (* x x))';

		const { expr } = parse_expr(scanTokens(str));
		expect(expr).toBeInstanceOf(LetExpr);
	});

	it('parses a named function', () => {
		const str = '(fn sum [x y] (+ x y))';

		const { expr } = parse_expr(scanTokens(str));
		expect(expr).toBeInstanceOf(FnExpr);
	});

	it('parses an anonymous function', () => {
		const str = '(fn [x] (* x 3))';

		const { expr } = parse_expr(scanTokens(str));
		expect(expr).toBeInstanceOf(FnExpr);
	});
});

describe('structural parsing', () => {
	it('fails to parse dangling parentheses', () => {
		const str = '(+ 2 3';

		expect(() => parse_expr(scanTokens(str))).toThrow();
	});

	it('fails to parse mismatched parentheses', () => {
		const str = '((()(()))';

		expect(() => parse_expr(scanTokens(str))).toThrow();
	});
});
