#!/usr/bin/env bash
set -euo pipefail

vm_dir=/home/rong/.local/share/bliss-os16-test

if pgrep -f '^qemu-system-x86_64 -name bliss16-wechat ' >/dev/null; then
  echo 'Bliss OS 16 已经在运行。'
  exit 0
fi

exec qemu-system-x86_64 \
  -name bliss16-wechat \
  -machine q35,accel=kvm \
  -cpu host \
  -smp 4 \
  -m 4096 \
  -drive if=pflash,format=raw,readonly=on,file=/usr/share/OVMF/OVMF_CODE_4M.fd \
  -drive if=pflash,format=raw,file="$vm_dir/OVMF_VARS_4M.fd" \
  -drive if=virtio,format=qcow2,file="$vm_dir/bliss16-wechat.qcow2" \
  -boot order=c \
  -netdev user,id=net0,hostfwd=tcp:127.0.0.1:5557-:5555 \
  -device virtio-net-pci,netdev=net0 \
  -device virtio-vga \
  -device virtio-tablet \
  -display gtk,zoom-to-fit=on \
  -monitor unix:"$vm_dir/monitor.sock",server=on,wait=off \
  -serial unix:"$vm_dir/serial.sock",server=on,wait=off
