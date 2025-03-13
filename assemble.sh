#!/bin/bash

for filename in output/*.s; do
    nasm -O1 -f elf -g -F dwarf "$filename"
done

ld -melf_i386 -o output/main output/*.o

./output/main; echo $?
