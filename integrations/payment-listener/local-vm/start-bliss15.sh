#!/usr/bin/env bash
set -euo pipefail

vm_dir=/home/rong/.local/share/bliss-os
disk="$vm_dir/bliss15-wechat.qcow2"

if pgrep -f '^qemu-system-x86_64 -name bliss15-wechat ' >/dev/null; then
  echo 'Bliss OS 虚拟机已经在运行。'
  exit 0
fi

exec qemu-system-x86_64 \
  -name bliss15-wechat \
  -machine q35,accel=kvm \
  -cpu host \
  -smp 4 \
  -m 3072 \
  -drive if=pflash,format=raw,readonly=on,file=/usr/share/OVMF/OVMF_CODE_4M.fd \
  -drive if=pflash,format=raw,file="$vm_dir/OVMF_VARS_4M.fd" \
  -drive if=virtio,format=qcow2,file="$disk" \
  -boot order=c \
  -netdev user,id=net0,hostfwd=tcp:127.0.0.1:5556-:5555 \
  -device virtio-net-pci,netdev=net0 \
  -device virtio-vga \
  -device virtio-tablet \
  -display gtk,zoom-to-fit=on \
  -monitor unix:"$vm_dir/monitor.sock",server=on,wait=off \
  -serial unix:"$vm_dir/serial.sock",server=on,wait=off
