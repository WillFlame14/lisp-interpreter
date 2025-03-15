; Ends the process, returning the value of eax as the exit code.
global __debexit
__debexit:
	mov ebx, eax
	mov eax, 1   ; sys_exit system call
	int 0x80