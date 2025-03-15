; Ends the process, returning the value of rax as the exit code.
global __debexit
__debexit:
	mov rdi, rax
	mov rax, 60   ; sys_exit system call
	syscall