extern __debexit

global __alloc_init
__alloc_init:
	push rbp
	mov rbp, rsp
	mov rdi, 0
	mov rax, SYS_BRK
	syscall
	inc rax
	mov [heap_begin], rax
	mov [current_break], rax
	pop rbp
	ret

global __allocate
__allocate:
	push rbp
	mov rbp, rsp
	mov rcx, rax				; rcx holds desired size
	mov rax, [heap_begin]		; rax holds current search
	mov rdi, [current_break]	; rdi holds current break

alloc_loop:
	cmp rax, rdi
	je move_break
	mov rdx, [rax+HDR_SIZE_OFFSET]		; rdx holds size of current block
	cmp [rax+HDR_AVAIL_OFFSET], dword USED
	je next_loc
	cmp rdx, rcx
	jle alloc_here

next_loc:
	add rax, HEADER_SIZE
	add rax, rdx
	jmp alloc_loop

alloc_here:
	mov [rax+HDR_AVAIL_OFFSET], dword USED
	add rax, HEADER_SIZE
	pop rbp
	ret

move_break:
	add rdi, HEADER_SIZE
	add rdi, rcx
	push rax
	push rdi
	push rcx
	mov rax, SYS_BRK
	syscall
	cmp rax, 0
	je no_alloc
	pop rcx
	pop rdi
	pop rax
	mov [rax+HDR_AVAIL_OFFSET], dword USED
	mov [rax+HDR_SIZE_OFFSET], rcx
	add rax, HEADER_SIZE
	mov [current_break], rdi
	pop rbp
	ret
	
no_alloc:
	mov rax, 22
	call __debexit

global __deallocate
__deallocate:
	sub rax, HEADER_SIZE
	mov [rax+HDR_AVAIL_OFFSET], dword UNUSED
	ret

section .data
	heap_begin: dq 0
	current_break: dq 0

	HEADER_SIZE: equ 16
	HDR_AVAIL_OFFSET: equ 0
	HDR_SIZE_OFFSET: equ 8

	USED: equ 0
	UNUSED: equ 1
	SYS_BRK: equ 12