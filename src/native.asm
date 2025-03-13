plus:
	push ebp
	mov ebp, esp
	mov eax, [ebp+12]
	mov ebx, [ebp+8]
	add eax, ebx
	pop ebp
	ret

minus:
	push ebp
	mov ebp, esp
	mov eax, [ebp+12]
	mov ebx, [ebp+8]
	sub eax, ebx
	pop ebp
	ret

eq:
	push ebp
	mov ebp, esp
	mov eax, [ebp+12]
	mov ebx, [ebp+8]
	cmp eax, ebx
	sete al
	movzx eax, al
	pop ebp
	ret

; Outputs the low-order byte of eax to standard output.
nativeWrite:
    push ebx       ; callee save ebx
    mov [char], al ; save the low order byte in memory
    mov eax, 4     ; sys_write system call
    mov ecx, char  ; address of bytes to write
    mov ebx, 1     ; stdout
    mov edx, 1     ; number of bytes to write
    int 0x80
    mov eax, 0     ; return 0
    pop ebx        ; restore ebx
    ret

