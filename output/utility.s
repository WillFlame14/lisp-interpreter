; first 6 parameters are in registers rdi, rsi, rdx, rcx, r8, r9
; return value is in register rax
; registers that must be saved are rbx, rsp, rbp, r12-r15

; fn prelude
; push rbp
; mov rbp, rsp

; fn coda
; pop rbp

extern writeString
extern __exception

global __toBool
__toBool:
	shl rax, 3
	or rax, 1
	ret

global __toInt
__toInt:
	shl rax, 3
	or rax, 2
	ret

global __toClosure
__toClosure:
	or rax, 3
	ret

global __toList
__toList:
	shl rax, 3
	or rax, 4
	ret

global __toString
__toString:
	or rax, 5
	ret

global __removeTag
__removeTag:
	shr rax, 3
	shl rax, 3
	ret

global __boolean?
__boolean?:
	and rax, 111b
	cmp rax, 1
	je cmp_true
	jmp cmp_false

global __int?
__int?:
	and rax, 111b
	cmp rax, 2
	je cmp_true
	jmp cmp_false

global __fn?
__fn?:
	and rax, 111b
	cmp rax, 3
	je cmp_true
	jmp cmp_false

global __list?
__list?:
	and rax, 111b
	cmp rax, 4
	je cmp_true
	jmp cmp_false

global __string?
__string?:
	and rax, 111b
	cmp rax, 5
	je cmp_true
	jmp cmp_false

global __nil?
__nil?:
	cmp rax, 0
	je cmp_true
	jmp cmp_false

cmp_true:
	mov rax, dword 1
	call __toBool
	ret

cmp_false:
	mov rax, dword 0
	call __toBool
	ret

global err_arg_int
err_arg_int:
	mov rsi, arg_int_msg
	mov rdx, 12
	call writeString
	call __exception

global err_arg_bool
err_arg_bool:
	mov rsi, arg_bool_msg
	mov rdx, 13
	call writeString
	call __exception

global err_arg_list
err_arg_list:
	mov rsi, arg_list_msg
	mov rdx, 13
	call writeString
	call __exception

global err_arg_string
err_arg_string:
	mov rsi, arg_string_msg
	mov rdx, 15
	call writeString
	call __exception

global err_arg_fn
err_arg_fn:
	mov rsi, arg_fn_msg
	mov rdx, 17
	call writeString
	call __exception

section .data
	arg_int_msg: dw "Expected int"
	arg_bool_msg: dw "Expected bool"
	arg_list_msg: dw "Expected list"
	arg_string_msg: dw "Expected string"
	arg_fn_msg: dw "Expected function"