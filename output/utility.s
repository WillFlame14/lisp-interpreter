; first 6 parameters are in registers rdi, rsi, rdx, rcx, r8, r9
; return value is in register rax
; registers that must be saved are rbx, rsp, rbp, r12-r15

; fn prelude
; push rbp
; mov rbp, rsp

; fn coda
; pop rbp

extern writeString
extern __allocate
extern __exception
extern __error

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

global __isClosure
__isClosure:
	mov rcx, 7
	and rcx, rax
	cmp rcx, 3
	jne __error
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

; rdi holds size, rsi holds address of "first" element (last element, since args are in reverse order)
global __make_list
__make_list:
	push rbp
	mov rbp, rsp
	push rbx
	mov rbx, 0				; counter stored in call-preserved rbx
	push r12
	mov r12, rsi 			; address of first element stored in call-preserved r12
	push r13
	mov r13, rdi			; size stored in call-preserved r13
	mov rcx, dword 0 		; set up initial next ptr to be NULL
	push rcx
__make_list_loop:
	mov rax, 16
	call __allocate
	pop rcx					; pop next ptr into rcx
	mov rdx, [r12+8*rbx]	; retrieve value from stack (param)
	mov [rax], rdx			; set value
	mov [rax+8], rcx		; set next pointer
	push rax				; set up next ptr for next node
	inc rbx
	cmp rbx, r13
	jne __make_list_loop
	pop rax					; get final ptr
	pop r13
	pop r12
	pop rbx
	pop rbp
	ret

; rax holds # of args, rdi holds func closure
; stack:
; <saved rbx> (added in first line)
; <lisp_call return address>
; <saved # of params to pop off later>
; <original caller return address>
; <argN>
; ...
; <arg1>
set_args:
	push rbx				; store size of new stack in call-preserved rbx
	mov rbx, 0
	mov r10, 0				; counter
	cmp rax, 5
	jl .reg_params
	sub rax, 5
.stack_loop:
	mov rdx, [rsp+r10*8+32]	; retrieve value from stack
	push rdx
	inc r10
	cmp rax, r10
	jne .stack_loop
	mov rbx, r10			; save size of new stack
.reg_params:
	cmp rax, 5
	jl .arity_4
	mov r9, [rsp+r10*8+32]
	inc r10
.arity_4:
	cmp rax, 4
	jl .arity_3
	mov r8, [rsp+r10*8+32]
	inc r10
.arity_3:
	cmp rax, 3
	jl .arity_2
	mov rcx, [rsp+r10*8+32]
	inc r10
.arity_2:
	cmp rax, 2
	jl .arity_1
	mov rdx, [rsp+r10*8+32]
	inc r10
.arity_1:
	cmp rax, 1
	jl .arity_0
	mov rsi, [rsp+r10*8+32]
	inc r10
.arity_0:
	call [rdi]
	lea rsp, [rsp+rbx*8]	; pop all new stack params
	pop rbx
	ret

; rax holds # of args, rdi holds func closure
; stack:
; <caller return address>
; <argN>
; ...
; <arg1>
global __lisp_call
__lisp_call:
	movzx rcx, word [rdi+8]	; arity stored in rcx
	movzx rdx, word [rdi+12]
	cmp rdx, 0				; varargs?
	jz .fixed
	sub rax, rcx			; # params passed - arity = # of varargs
	push rcx				; save arity
	push rdi				; save closure address
	push rax				; save # of varargs
	lea rsi, [rsp+8]		; load start of args
	mov rdi, rax
	call __make_list
	pop r10					; restore # of varargs in r10
	pop rdi					; restore closure address in rdi
	pop rcx					; restore arity in rcx
	pop rdx					; save return address
	lea rsp, [rsp+r10*8]	; pop off all vararg params
	push rax				; push varargs list to stack
	push rdx				; add return address back
	inc rcx
.fixed:
	push rcx				; push # of args on stack
	call set_args
	pop rcx					; pop # of args
	pop rdx					; save return address
	lea rsp, [rsp+rcx*8]	; pop all args
	jmp rdx

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