import * as fs from 'node:fs';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

import { scanTokens } from './scanner.ts';

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
}

function prompt() {
	console.log('Welcome to the REPL:');

	const rl = readline.createInterface({ input, output });
	rl.on('line', run);
}

function run(source: string) {
	const tokens = scanTokens(source);

	for (const token of tokens)
		console.log(token);
}

main();