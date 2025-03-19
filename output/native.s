extern __debexit
extern __allocate
extern __deallocate

; first 6 parameters are in registers rdi, rsi, rdx, rcx, r8, r9
; return value is in register rax
; registers that must be saved are rbx, rsp, rbp, r12-r15

; fn prelude
; push rbp
; mov rbp, rsp

; fn coda
; pop rbp

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

__plus:
	shr rsi, 3
	shr rdx, 3
	add rsi, rdx
	mov rax, rsi
	call __toInt
	ret

__minus:
	shr rsi, 3
	shr rdx, 3
	sub rsi, rdx
	mov rax, rsi
	call __toInt
	ret

__eq:
	mov rax, rsi
	mov rbx, rdx
	cmp rax, rbx
	sete al
	movzx rax, al
	call __toBool
	ret

__cons:
	shr rdx, 3 			; remove list tag
	push rsi			; save params before calling allocate
	push rdx
	mov rax, 16
	call __allocate
	pop rdx
	pop rsi
	mov [rax], rsi		; item
	mov [rax+8], rdx 	; list
	call __toList
	ret

__peek:
	shr rsi, 3 			; remove list tag
	mov rax, [rsi]
	ret

__pop:
	shr rsi, 3 			; remove list tag
	mov rax, rsi
	mov rbx, [rsi+8]	; new head
	push rbx
	call __deallocate	; dealloc head
	pop rax
	call __toList
	ret

__nth:
	shr rsi, 3 		; remove list tag
	mov rax, rsi	; head (curr)
	mov rbx, rdx	; i
	shr rbx, 3		; remove ptr tag
nth_loop:
	cmp rbx, 4
	je nth_peek
	sub rbx, 1
	mov rax, [rax+8]
	jmp nth_loop
nth_peek:
	mov rax, [rax]
	ret

__count:
	shr rsi, 3  	; remove list tag
	mov rbx, rsi	; head (curr)
	mov rax, 0 		; counter
count_loop:
	cmp rbx, 4
	je counted
	mov rbx, [rbx+8]
	inc rax
	jmp count_loop
counted:
	call __toInt
	ret

div10:
	mov rdx, 0xCCCCCCCCCCCCCCCD
	mov rax, rdi
	mul rdx
	mov rax, rdx
	shr rax, 3
	ret

mod10:
	mov rdx, 0xCCCCCCCCCCCCCCCD
	mov rax, rdi
	mul rdx
	shr rdx, 3
	lea rcx, [rdx+rdx*4]
	add rcx, rcx
	sub rdi, rcx
	mov rax, rdi
	ret

global __print
__print:
	mov rax, 7
	and rax, rsi
	cmp rax, 0
	je print_nil
	cmp rax, 1
	je print_bool
	cmp rax, 2
	je print_int
	cmp rax, 3
	je print_fn
	cmp rax, 4
	je print_list
print_nil:
	mov rsi, nil_msg
	mov rdx, 3
	jmp print_end
print_bool:
	shr rsi, 3
	cmp rsi, 0
	je print_false
	mov rsi, true_msg
	mov rdx, 4
	call writeString
	jmp print_end
print_false:
	mov rsi, false_msg
	mov rdx, 5
	call writeString
	jmp print_end
print_int:
	shr rsi, 3
	mov rax, rsi
	push r12
	push r13
	mov r12, 0
get_digit:
	mov rdi, rax
	call mod10
	push rax
	mov rdi, rsi
	call div10
	mov rsi, rax
	add r12, 1
	cmp rsi, 0
	jne get_digit
	mov r13, r12
	mov rdx, 1
print_digit:
	pop rax
	add rax, 48
	mov [char], al	; shift into ascii
	mov rsi, char
	call writeString
	sub r13, 1
	cmp r13, 0
	jne print_digit
	pop r13
	pop r12
	jmp print_end
print_fn:
	mov rsi, fn_msg
	mov rdx, 10
	call writeString
	jmp print_end
print_list:
	push r12
	mov r12, rsi 	; store curr in call-preserved r12
	shr r12, 3 		; remove list tag
	mov [char], word '('
	mov rsi, char
	mov rdx, 1
	call writeString
	cmp r12, 4
	je list_end	; check for empty list
	mov rsi, [r12]
	call __print
	mov r12, [r12+8]
	cmp r12, 4
	je list_end	; print first element
print_link:
	mov [char], word ' '
	mov rsi, char
	mov rdx, 1
	call writeString
	mov rsi, [r12]
	call __print
	mov r12, [r12+8]
	cmp r12, 4
	jne print_link
list_end:
	mov [char], word ')'
	mov rsi, char
	mov rdx, 1
	call writeString
	pop r12
	jmp print_end
print_end:
	mov rax, 0
	ret

; rsi holds address of bytes, rdx holds number of bytes
writeString:
	mov rax, 1     ; sys_write system call
	mov rdi, 1     ; stdout
	syscall
	ret

; Outputs the low-order byte of rax to standard output.
; Broken in 64-bit, need to look at syscalls again.
global __nativeWrite
__nativeWrite:
	push rbx       ; callee save rbx
	mov [char], al ; save the low order byte in memory
	mov rax, 1     ; sys_write system call
	mov rsi, char  ; address of bytes to write
	mov rdi, 1     ; stdout
	mov rdx, 1     ; number of bytes to write
	syscall
	mov rax, 0     ; return 0
	pop rbx        ; restore rbx
	ret

; Allocates rax bytes of memory. Pointer to allocated memory returned in rax.
malloc:
	push rbx     ; callee save rbx
	push rax
	mov rax, 45  ; sys_brk system call
	mov rbx, 0   ; 0 bytes - query current brk
	syscall
	pop rbx
	push rax
	add rbx, rax ; move brk ahead by number of bytes requested
	mov rax, 45  ; sys_brk system call
	syscall
	pop rbx
	cmp rax, 0   ; on error, exit with code 22
	jne ok
	mov rax, 22
	call __debexit
ok:
	mov rax, rbx
	pop rbx      ; restore rbx
	ret

global __error
__error:
	mov rdi, 1     ; stdout
	mov rsi, err_msg
	mov rdx, 17     ; number of bytes to write
	call writeString
	syscall
	mov rax, 1
	call __debexit

global __plus_closure
global __minus_closure
global __eq_closure
global __cons_closure
global __peek_closure
global __pop_closure
global __nth_closure
global __count_closure
global __print_closure

section .data
	char: dd 0

	nil_msg: dw "nil"
	true_msg: dw "true"
	false_msg: dw "false"
	fn_msg: dw "<function>"
	err_msg: dw "Encountered error"

	ALIGN 8
	__plus_closure: dq __plus
	__minus_closure: dq __minus
	__eq_closure: dq __eq
	__cons_closure: dq __cons
	__peek_closure: dq __peek
	__pop_closure: dq __pop
	__nth_closure: dq __nth
	__count_closure: dq __count
	__print_closure: dq __print
