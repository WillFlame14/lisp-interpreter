import * as fs from 'node:fs';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { execFile } from 'node:child_process';

import { scanTokens } from './scanner.ts';
import { parse } from './parser.ts';
import { interpret, RuntimeError } from './interpreter.ts';
import { astPrinter } from './ast.ts';
import { compile } from './asm.ts';

let hadError = false, hadRuntimeError = false;

function main() {
	const args = process.argv.slice(2);

	if (args.length > 0)
		runFile(args[0]);
	else
		prompt();
}

function runFile(path: string) {
	console.log(`Interpreting file ${path}`);

	const source = fs.readFileSync(path, 'utf8');
	const program = run(source);

	if (hadError)
		process.exit(65);

	if (hadRuntimeError)
		process.exit(70);

	if (program !== undefined) {
		const native = fs.readFileSync('src/native.asm', 'utf8');
		fs.writeFileSync('output/out.s', native + '\n\n' + compile(program));

		execFile('./assemble.sh', (_error, stdout, _stderr) => {
			console.dir(stdout);
		});
	}
}

function prompt() {
	console.log('Welcome to the REPL:');

	const rl = readline.createInterface({ input, output });
	rl.on('line', (source) => {
		run(source);
		hadError = false;
	});
}

function run(source: string) {
	const tokens = scanTokens(source);
	const program = parse(tokens);

	if (hadError) {
		console.log('err, skipping execution');
		return;
	}

	// console.log(program.map(expr => expr.accept(astPrinter)).join('\n'));

	// interpret(program);

	return program;
}

export function error(line: number, message: string) {
	report(line, '', message);
}

export function report(line: number, where: string, message: string) {
	console.error(`[line ${line}] Error${where}: ${message}`);
	hadError = true;
}

export function runtimeError(error: RuntimeError) {
	console.error(`${error.message}\n[line ${error.token.line}]`);
	hadRuntimeError = true;
}

main();
