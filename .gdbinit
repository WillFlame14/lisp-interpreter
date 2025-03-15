set debuginfod enabled off

break _start
layout src

define hook-step
info reg eax ebx ecx edx
x/10x $sp
end