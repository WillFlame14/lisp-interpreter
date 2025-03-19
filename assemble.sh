#!/bin/bash

for filename in output/*.s; do
    nasm -O1 -f elf64 -g -F dwarf "$filename"
done

ld -o output/main output/*.o # -m elf_i386

./output/main; echo " | exited with code" $?
