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
