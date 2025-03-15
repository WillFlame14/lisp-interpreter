extern __debexit
extern __allocate
extern __deallocate

global __plus
__plus:
	push rbp
	mov rbp, rsp
	mov rax, [rbp+24]
	mov rbx, [rbp+16]
	add rax, rbx
	pop rbp
	ret

global __minus
__minus:
	push rbp
	mov rbp, rsp
	mov rax, [rbp+24]
	mov rbx, [rbp+16]
	sub rax, rbx
	pop rbp
	ret

global __eq
__eq:
	push rbp
	mov rbp, rsp
	mov rax, [rbp+24]
	mov rbx, [rbp+16]
	cmp rax, rbx
	sete al
	movzx rax, al
	pop rbp
	ret

global __cons
__cons:
	push rbp
	mov rbp, rsp
	mov rax, 16
	push rax
	call __allocate
	add rsp, 4
	mov rcx, [rbp+24]	; item
	mov [rax], rcx
	mov rbx, [rbp+16]	; list
	mov [rax+4], rbx
	pop rbp
	ret

global __peek
__peek:
	push rbp
	mov rbp, rsp
	mov rax, [rbp+16]
	mov rax, [rax]
	pop rbp
	ret

global __pop
__pop:
	push rbp
	mov rbp, rsp
	mov rax, [rbp+16]
	mov rbx, [rax+4]	; new head
	push rbx
	call __deallocate	; dealloc head
	pop rax
	pop rbp
	ret

global __nth
__nth:
	push rbp
	mov rbp, rsp
	mov rax, [rbp+24]	; head (curr)
	mov rbx, [rbp+16]	; i
nth_loop:
	cmp rbx, 0
	je nth_peek
	sub rbx, 1
	mov rax, [rax+4]
	jmp nth_loop
nth_peek:
	mov rax, [rax]
	pop rbp
	ret

global __count
__count:
	push rbp
	mov rbp, rsp
	mov rbx, [rbp+16]	; head (curr)
	mov rax, 0 			; counter
count_loop:
	cmp rbx, 0
	je counted
	mov rbx, [rbx+4]
	inc rax
	jmp count_loop
counted:
	pop rbp
	ret

; Outputs the low-order byte of rax to standard output.
; Broken in 64-bit, need to look at syscalls again.
global __nativeWrite
__nativeWrite:
	push rbx       ; callee save rbx
	mov [char], al ; save the low order byte in memory
	mov rax, 4     ; sys_write system call
	mov rcx, char  ; address of bytes to write
	mov rbx, 1     ; stdout
	mov rdx, 1     ; number of bytes to write
	syscall
	mov rax, 0     ; return 0
	pop rbx        ; restore rbx
	ret

; Allocates rax bytes of memory. Pointer to allocated memory returned in rax.
global malloc
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

section .data
	char: dd 0