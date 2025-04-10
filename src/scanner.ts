import { error } from './main.ts';
import { Token, TokenType } from './token.ts';

const charTokenMap = {
	'(': TokenType.L_PAREN,
	')': TokenType.R_PAREN,
	'[': TokenType.L_SQUARE,
	']': TokenType.R_SQUARE
} as const;

const keywordMap = {
	true: TokenType.TRUE,
	false: TokenType.FALSE,
	nil: TokenType.NIL
} as const;

export function scanTokens(source: string) {
	let start = 0, current = 0, line = 1;
	const tokens: Token[] = [];

	const addToken = (type: TokenType, literal?: unknown) => {
		const lexeme = source.substring(start, current);
		tokens.push({ type, lexeme, literal, line });
	};

	while (start < source.length) {
		const char = source.charAt(current);
		current++;

		if (char in charTokenMap) {
			const token = charTokenMap[char as keyof typeof charTokenMap];
			addToken(token);
			start = current;
			continue;
		}

		switch (char) {
			case '"':
				// Scan string until closing quote
				while (source.charAt(current) !== '"' && current < source.length) {
					if (source.charAt(current) === '\n')
						line++;
					current++;
				}

				if (current === source.length)
					error(line, 'Unterminated string.');

				// Consume the closing quote
				current++;

				// Remove the quotes from the literal.
				addToken(TokenType.STRING, source.substring(start + 1, current - 1));
				break;
			case ' ':
			case '\r':
			case '\t':
				break;
			case '\n':
				line++;
				break;
			default:
				if (/[0-9.]/.test(char)) {
					// Scan number
					while (/[0-9.]/.test(source.charAt(current)) && current < source.length)
						current++;

					addToken(TokenType.NUMBER, Number(source.substring(start, current)));
					break;
				}

				if (/[a-zA-Z_+\-/*=<>!&?]/.test(char)) {
					// Scan symbol
					while (/[a-zA-Z0-9_+\-*/=<>!&?]/.test(source.charAt(current)) && current < source.length)
						current++;

					const string = source.substring(start, current);
					if (string in keywordMap) {
						const keyword = keywordMap[string as keyof typeof keywordMap];
						addToken(keyword);
					}
					else {
						addToken(TokenType.SYMBOL);
					}
					break;
				}

				error(line, `Unexpected character ${char} (code ${char.charCodeAt(0)}).`);
		}

		start = current;
	}

	tokens.push({ type: TokenType.EOF, lexeme: '', literal: undefined, line });
	return tokens;
}
