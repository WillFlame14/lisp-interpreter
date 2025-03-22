; Ends the process, returning the value of rax as the exit code.
global __debexit
__debexit:
	mov rdi, rax
	mov rax, 60   ; sys_exit system call
	syscall

global __exception
__exception:
	mov rdi, 13
	mov rax, 60   ; sys_exit system call
	syscall