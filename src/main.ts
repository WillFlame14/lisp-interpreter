import * as fs from 'node:fs';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

import { scanTokens } from './scanner.ts';
import { parse_expr } from './parser.ts';
import { astPrinter } from './ast.ts';

let hadError = false;

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
	run(source);

	if (hadError)
		process.exit(65);
}

function prompt() {
	console.log('Welcome to the REPL:');

	const rl = readline.createInterface({ input, output });
	rl.on('line', run);
	hadError = false;
}

function run(source: string) {
	const tokens = scanTokens(source);

	const { expr } = parse_expr(tokens);

	console.log(expr.accept(astPrinter));
}

export function error(line: number, message: string) {
	report(line, '', message);
}

function report(line: number, where: string, message: string) {
	console.log(`[line ${line}] Error${where}: ${message}`);
	hadError = true;
}

main();
