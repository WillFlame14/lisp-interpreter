import * as fs from 'node:fs';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

import { scanTokens } from './scanner.ts';
import { parse } from './parser.ts';
import { interpret, RuntimeError } from './interpreter.ts';
import { compile } from './asm.ts';
import { macroexpand } from './reader.ts';
import { CompileError, static_check } from './checker.ts';

let hadError = false, hadCompileError = false, hadRuntimeError = false;

function main() {
	const args = process.argv.slice(2);

	if (args.length > 0)
		runFile(args[0]);
	else
		prompt();
}

function runFile(path: string) {
	const source = fs.readFileSync(path, 'utf8');
	const stdout = run(source);

	if (hadError || hadCompileError)
		process.exit(65);

	if (hadRuntimeError)
		process.exit(70);

	console.dir(stdout);
}

function prompt() {
	console.log('Welcome to the REPL:');

	const rl = readline.createInterface({ input, output });
	rl.on('line', (source) => {
		const stdout = run(source);
		console.dir(stdout);
		hadError = false;
		hadCompileError = false;
		hadRuntimeError = false;
	});
}

export function run(source: string) {
	const tokens = scanTokens(source);
	const program = parse(tokens);

	if (hadError) {
		console.log('err, skipping execution');
		return;
	}

	// console.log(program.map(expr => expr.accept(astPrinter)).join('\n'));

	const expanded = macroexpand(program);
	console.log(`expanded:\n${expanded.map(expr => expr.toString()).join('\n')}`);

	const exprs = static_check(expanded);
	console.log(`static checked:\n${exprs.map(e => e.toString()).join('\n')}`);

	return interpret(exprs);
	// fs.writeFileSync('output/out.s', compile(expanded));

	// try {
	// 	const proc = Bun.spawnSync({ cmd: ['./assemble.sh'] });
	// 	return proc.stdout.toString();
	// }
	// catch (err) {
	// 	console.log(err);
	// 	return;
	// }
}

export function error(line: number, message: string) {
	report(line, '', message);
}

export function report(line: number, where: string, message: string) {
	console.error(`[line ${line}] Error${where}: ${message}`);
	hadError = true;
}

export function compileError(error: CompileError) {
	console.error(`CompileError: ${error.message}\n[line ${error.token?.line}]`);
	hadCompileError = true;
}

export function runtimeError(error: RuntimeError) {
	console.error(`RuntimeError: ${error.message}\n[line ${error.token?.line}]`);
	hadRuntimeError = true;
}

main();
