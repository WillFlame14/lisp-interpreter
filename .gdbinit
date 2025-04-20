set debuginfod enabled off

break _start
layout src

define hook-step
info reg rax rbx rcx rdx
end
