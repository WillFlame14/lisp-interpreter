extern __debexit

global __alloc_init
__alloc_init:
	push ebp
	mov ebp, esp
	mov ebx, 0
	mov eax, SYS_BRK
	int LINUX_SYSCALL
	inc eax
	mov [heap_begin], eax
	mov [current_break], eax
	pop ebp
	ret

global __allocate
__allocate:
	push ebp
	mov ebp, esp
	mov ecx, eax				; ecx holds desired size
	mov eax, [heap_begin]		; eax holds current search
	mov ebx, [current_break]	; ebx holds current break

alloc_loop:
	cmp eax, ebx
	je move_break
	mov edx, [eax+HDR_SIZE_OFFSET]		; edx holds size of current block
	cmp [eax+HDR_AVAIL_OFFSET], word USED
	je next_loc
	cmp edx, ecx
	jle alloc_here

next_loc:
	add eax, HEADER_SIZE
	add eax, edx
	jmp alloc_loop

alloc_here:
	mov [eax+HDR_AVAIL_OFFSET], word USED
	add eax, HEADER_SIZE
	pop ebp
	ret

move_break:
	add ebx, HEADER_SIZE
	add ebx, ecx
	push eax
	push ebx
	push ecx
	mov eax, SYS_BRK
	int LINUX_SYSCALL
	cmp eax, 0
	je no_alloc
	pop ecx
	pop ebx
	pop eax
	mov [eax+HDR_AVAIL_OFFSET], word USED
	mov [eax+HDR_SIZE_OFFSET], ecx
	add eax, HEADER_SIZE
	mov [current_break], ebx
	pop ebp
	ret
	
no_alloc:
	mov eax, 22
	call __debexit

global __deallocate
__deallocate:
	sub eax, HEADER_SIZE
	mov [eax+HDR_AVAIL_OFFSET], word UNUSED
	ret

section .data
	heap_begin: dd 0
	current_break: dd 0

	HEADER_SIZE: equ 8
	HDR_AVAIL_OFFSET: equ 0
	HDR_SIZE_OFFSET: equ 4

	USED: equ 0
	UNUSED: equ 1
	SYS_BRK: equ 45
	LINUX_SYSCALL: equ 0x80