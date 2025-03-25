# lisp-interpreter
A basic interpreter for a custom Lisp.

## Getting Started

First, install [bun](https://bun.sh/).

`bun start [path]` will interpret a file. If a file path is not provided, an interactive REPL will be opened.

Dependencies are only for assisting with local development and can be installed with `bun install`.


## Language Features

The language is strongly based on Clojure, another Lisp. It has the following grammar:
```
string: '"' [\x00-\x7F]* '"'
number: [0-9.]+
symbol: [a-zA-Z_+-/*=<>!&?][a-zA-Z0-9_+-/*=<>!&?]*

literal: 'true' | 'false' | 'nil' | string | number | symbol
list: '(' primary* ')'
vector: '[' primary* ']'
primary: literal | symbol | list | vector

program: primary*
```

Function calls (s-expressions) are written exactly like lists, with the operator as the first element. For example:
```
(print "Hello world!") ; => "Hello world!"

(+ 2 (- 6 3)) ; => 5
```

There are various special forms: `if`, `let`, `do`, `fn`, `loop`/`recur` (not implemented yet), `quote`, `defn` (not implemented yet) and `defmacro`.

- `if` is used for control flow. It has the structure `(if cond true_child false_child)`.
	- (e.g. `(if true 3 4)` returns `3`)
- `let` is used for local binding of variables. It has the structure `(let bindings body)`, where `bindings` is a vector with odd elements as names and even elements as their corresponding values.
	- (e.g. `(let [x 4 y 5] (+ x y))` returns `9`)
- `fn` declares an inline function. It has the structure `(fn name? params body)`, where `params` is a vector of names corresponding to the parameters in order.
	- (e.g. `(fn mult [a b] (* a b)` returns a function that takes 2 arguments and returns their product)
- `loop` marks the start of a loop. It has the structure `(loop bindings body)`, where `bindings` is the same as those in `let`.
- `recur` jumps back to the nearest `loop`. It has the structure `(recur & new-bindings)`.
	- (e.g. `(loop [i 1] (if (< i 6) (do (print i) (recur (+ i 1)))))` prints out the numbers from 1 to 5.`)
- `quote` escapes evaluation. It has the structure `(quote value)`.
	- (e.g. `(quote (1 2 3))` returns the list `(1 2 3)`, without trying to evaluate this as a function call.)
- `defn` declares a function in global scope. It has the structure `(defn name params body)`.
- `defmacro` declares a macro in global scope. It has the structure `(defmacro name params body)`.

Various functions are also included in the standard library.

## Testing

Run `bun test <path-to-file>` to run a unit test file. Not providing a path runs all tests.

If you only want to run a specific test, add `--test-name-pattern="<some test name>"`.
