import { expect, describe, it } from 'bun:test';
import { run } from '../src/main.ts';

describe('list construction', () => {
	it('constructs a list', () => {
		const str = '(quote (3 1 4 1))';
		expect(run(str)).toEqual('(3 1 4 1)');
	});

	it('constructs an empty list', () => {
		const str = '(quote ())';
		expect(run(str)).toEqual('()');
	});
});

describe('list cons and pop', () => {
	it('can cons onto a list', () => {
		const str = '(cons 5 (quote (3 1 4 1)))';
		expect(run(str)).toEqual('(5 3 1 4 1)');
	});

	it('can cons onto an empty list', () => {
		const str = '(cons 5 (quote ()))';
		expect(run(str)).toEqual('(5)');
	});

	it('can pop from a list', () => {
		const str = '(pop (quote (9 7 5)))';
		expect(run(str)).toEqual('(7 5)');
	});

	it('can pop from a list of size 1', () => {
		const str = '(pop (quote (5)))';
		expect(run(str)).toEqual('()');
	});

	it('can pop and cons together', () => {
		const str = '(cons 1 (pop (cons 16 (cons 4 (pop (quote (5)))))))';
		expect(run(str)).toEqual('(1 4)');
	});

	it('errors when popping an empty list', () => {
		const str = '(pop (quote ()))';
		expect(() => run(str)).toThrow(`Can't pop empty list!`);
	});

	it('errors when popping an empty list after cons', () => {
		const str = '(pop (pop (pop (cons 4 (quote (5))))))';
		expect(() => run(str)).toThrow(`Can't pop empty list!`);
	});
});

describe('list count', () => {
	it('can count an empty list', () => {
		const str = '(count (quote ()))';
		expect(run(str)).toEqual('0');
	});

	it('can count a list', () => {
		const str = '(count (quote (3 1 4 1)))';
		expect(run(str)).toEqual('4');
	});

	it('can count a list after cons', () => {
		const str = '(count (cons 5 (quote (1 2 3 4))))';
		expect(run(str)).toEqual('5');
	});

	it('can count a list after popping to empty', () => {
		const str = '(count (cons 1 (cons 4 (pop (quote (1))))))';
		expect(run(str)).toEqual('2');
	});
});

describe('list nth', () => {
	it('can index the front of a list', () => {
		const str = '(nth (quote (0 1 2 3 4)) 0)';
		expect(run(str)).toEqual('0');
	});

	it('can index the back of a list', () => {
		const str = '(nth (quote (4 3 2 1 9)) 4)';
		expect(run(str)).toEqual('9');
	});

	it('can index the middle of a list', () => {
		const str = '(nth (quote (3 1 4 1 5)) 2)';
		expect(run(str)).toEqual('4');
	});

	it('can index a list after popping', () => {
		const str = '(nth (pop (quote (3 1 4 1 5))) 1)';
		expect(run(str)).toEqual('4');
	});

	it('can index a list after consing', () => {
		const str = '(nth (cons 5 (quote (3 1 4 1 5))) 1)';
		expect(run(str)).toEqual('3');
	});

	it('errors when indexing an empty list', () => {
		const str = '(nth (quote ()) 0)';
		expect(() => run(str)).toThrow(`nth index out of bounds!`);
	});

	it('errors when indexing out of bounds', () => {
		const str = '(nth (quote (2 5 7 6)) 6)';
		expect(() => run(str)).toThrow(`nth index out of bounds!`);
	});

	it('errors when indexing a negative number', () => {
		const str = '(nth (quote ()) (- 0 1))';
		expect(() => run(str)).toThrow(`nth index out of bounds!`);
	});
});
