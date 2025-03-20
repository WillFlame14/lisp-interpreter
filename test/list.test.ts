import { expect, describe, it } from 'bun:test';
import { run } from '../src/main.ts';


describe('list construction', () => {
	it('constructs a list', () => {
		const str = '(print (quote (3 1 4 1)))';
		expect(run(str)).toEqual('(3 1 4 1)');
	});

	it('constructs an empty list', () => {
		const str = '(print (quote ()))';
		expect(run(str)).toEqual('()');
	});
});

describe('list cons and pop', () => {
	it('can cons onto a list', () => {
		const str = '(print (cons 5 (quote (3 1 4 1))))';
		expect(run(str)).toEqual('(5 3 1 4 1)');
	});

	it('can cons onto an empty list', () => {
		const str = '(print (cons 5 (quote ())))';
		expect(run(str)).toEqual('(5)');
	});

	it('can pop from a list', () => {
		const str = '(print (pop (quote (9 7 5))))';
		expect(run(str)).toEqual('(7 5)');
	});

	it('can pop from a list of size 1', () => {
		const str = '(print (pop (quote (5))))';
		expect(run(str)).toEqual('()');
	});

	it('can pop and cons together', () => {
		const str = '(print (cons 1 (pop (cons 16 (cons 4 (pop (quote (5))))))))';
		expect(run(str)).toEqual('(1 4)');
	});
});

describe('list count', () => {
	it('can count an empty list', () => {
		const str = '(print (count (quote ())))';
		expect(run(str)).toEqual('0');
	});

	it('can count a list', () => {
		const str = '(print (count (quote (3 1 4 1))))';
		expect(run(str)).toEqual('4');
	});

	it('can count a list after cons', () => {
		const str = '(print (count (cons 5 (quote (1 2 3 4)))))';
		expect(run(str)).toEqual('5');
	});

	it('can count a list after popping to empty', () => {
		const str = '(print (count (cons 1 (cons 4 (pop (quote (1)))))))';
		expect(run(str)).toEqual('2');
	});
});
