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

cons:
	push ebp
	mov ebp, esp
	mov eax, 8
	push eax
	call malloc
	mov ecx, [ebp+12]	; item
	mov [eax], ecx
	mov ebx, [ebp+8]	; list
	mov [eax+4], ebx
	pop ebp
	ret

peek:
	push ebp
	mov ebp, esp
	mov eax, [ebp+8]
	mov eax, [eax]
	pop ebp
	ret

nth:
	push ebp
	mov ebp, esp
	mov eax, [ebp+12]	; head (curr)
	mov ebx, [ebp+8]	; i
nth_loop:
	cmp ebx, 0
	je nth_peek
	sub ebx, 1
	mov eax, [eax+4]
	jmp nth_loop
nth_peek:
	mov eax, [eax]
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

; Allocates eax bytes of memory. Pointer to allocated memory returned in eax.
malloc:
    push ebx     ; callee save ebx
    push eax
    mov eax, 45  ; sys_brk system call
    mov ebx, 0   ; 0 bytes - query current brk
    int 0x80
    pop ebx
    push eax
    add ebx, eax ; move brk ahead by number of bytes requested
    mov eax, 45  ; sys_brk system call
    int 0x80
    pop ebx
    cmp eax, 0   ; on error, exit with code 22
    jne ok
    mov eax, 22
    call __debexit
ok:
    mov eax, ebx
    pop ebx      ; restore ebx
    ret

; Debugging exit: ends the process, returning the value of
; eax as the exit code.
    global __debexit
__debexit:
    mov ebx, eax
    mov eax, 1   ; sys_exit system call
    int 0x80
