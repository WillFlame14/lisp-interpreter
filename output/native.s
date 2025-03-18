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

__toInt:
	shl rax, 3
	or rax, 2
	ret

__toBool:
	shl rax, 3
	or rax, 1
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
	mov rax, 16
	push rsi			; save params before calling allocate
	push rdx
	call __allocate
	pop rdx
	pop rsi
	mov [rax], rsi		; item
	mov [rax+8], rdx 	; list
	ret

__peek:
	mov rax, [rsi]
	ret

__pop:
	mov rax, rsi
	mov rbx, [rsi+8]	; new head
	push rbx
	call __deallocate	; dealloc head
	pop rax
	ret

__nth:
	mov rax, rsi	; head (curr)
	mov rbx, rdx	; i
	shr rbx, 3		; remove ptr tag
nth_loop:
	cmp rbx, 0
	je nth_peek
	sub rbx, 1
	mov rax, [rax+8]
	jmp nth_loop
nth_peek:
	mov rax, [rax]
	ret

__count:
	mov rbx, rsi	; head (curr)
	mov rax, 0 		; counter
count_loop:
	cmp rbx, 0
	je counted
	mov rbx, [rbx+8]
	inc rax
	jmp count_loop
counted:
	call __toInt
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
	mov rax, 1     ; sys_write system call
	mov rsi, err_msg  ; address of bytes to write
	mov rdi, 1     ; stdout
	mov rdx, 17     ; number of bytes to write
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

section .data
	char: dd 0

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
