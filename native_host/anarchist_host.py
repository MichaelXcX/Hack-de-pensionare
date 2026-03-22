#!/usr/bin/env python3
"""
Anarchist Native Messaging Host
Receives messages from the Chrome extension and executes privileged OS commands.
"""

import sys
import json
import struct
import subprocess
import platform

def read_message():
    """Read a native message from Chrome (4-byte length prefix + JSON body)."""
    raw_length = sys.stdin.buffer.read(4)
    if not raw_length:
        return None
    length = struct.unpack('=I', raw_length)[0]
    body = sys.stdin.buffer.read(length).decode('utf-8')
    return json.loads(body)

def send_message(msg):
    """Send a native message back to Chrome."""
    encoded = json.dumps(msg).encode('utf-8')
    sys.stdout.buffer.write(struct.pack('=I', len(encoded)))
    sys.stdout.buffer.write(encoded)
    sys.stdout.buffer.flush()

def shutdown():
    os_name = platform.system()
    # start_new_session=True detaches the subprocess from Chrome's process group
    # so it survives after Chrome (and this host) are killed.
    if os_name == 'Darwin':
        subprocess.Popen(
            ['osascript', '-e', 'tell application "System Events" to shut down'],
            close_fds=True, start_new_session=True
        )
    elif os_name == 'Linux':
        subprocess.Popen(['systemctl', 'poweroff'], close_fds=True, start_new_session=True)
    elif os_name == 'Windows':
        subprocess.Popen(['shutdown', '/s', '/t', '0'], close_fds=True, start_new_session=True)

def main():
    while True:
        msg = read_message()
        if msg is None:
            break

        action = msg.get('action')

        if action == 'ping':
            send_message({'ok': True, 'platform': platform.system()})

        elif action == 'shutdown':
            send_message({'ok': True, 'msg': 'Shutting down...'})
            shutdown()

        else:
            send_message({'ok': False, 'error': f'Unknown action: {action}'})

if __name__ == '__main__':
    main()
