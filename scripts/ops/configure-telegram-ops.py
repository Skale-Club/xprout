#!/usr/bin/env python3
"""Validate an ops bot and save credentials without displaying or writing its token locally."""
import argparse
import getpass
import json
import os
from pathlib import Path
import re
import shlex
import subprocess
import sys
import urllib.error
import urllib.request


def telegram(token, method, fields=None):
    request = urllib.request.Request(
        f'https://api.telegram.org/bot{token}/{method}',
        data=json.dumps(fields or {}).encode(),
        headers={'Content-Type': 'application/json'},
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            body = json.loads(response.read(65536))
    except urllib.error.HTTPError as error:
        body = json.loads(error.read(65536))
    except Exception:
        raise RuntimeError('Telegram connection failed; no credentials were displayed.') from None
    if not body.get('ok'):
        migrated = body.get('parameters', {}).get('migrate_to_chat_id')
        if method == 'getChat' and migrated:
            return telegram(token, method, {'chat_id': migrated})
        reason = str(body.get('description', 'verification failed')).replace(token, '[redacted]')[:180]
        raise RuntimeError(f'Telegram {method} rejected verification (code {body.get("error_code", "unknown")}): {reason}')
    return body['result']


def gh(*args, value):
    result = subprocess.run(['gh', *args], input=value, text=True, capture_output=True, timeout=45)
    if result.returncode:
        raise RuntimeError('GitHub configuration failed. Check gh authentication; token was not printed.')


HOST_INSTALL = '''import json,os,sys,tempfile
data=json.load(sys.stdin)
fd,path=tempfile.mkstemp(prefix='.xprout-ops-',dir='/etc')
try:
    os.fchmod(fd,0o600)
    with os.fdopen(fd,'w') as f:
        for k,v in data.items():
            f.write(k+'='+v+'\\n')
        f.flush();os.fsync(f.fileno())
    os.replace(path,'/etc/xprout-ops.env')
finally:
    if os.path.exists(path):os.unlink(path)
print('Dedicated host credentials saved; notifications remain disabled.')
'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--chat-id')
    parser.add_argument('--repo', default='Skale-Club/xprout')
    parser.add_argument('--host', default='root@188.245.112.3')
    parser.add_argument('--status-file', default='output/telegram-ops/setup-status.json')
    parser.add_argument('--discover-chats', action='store_true', help='Read group identities from pending bot updates; never change a webhook.')
    args = parser.parse_args()
    if not args.discover_chats and not args.chat_id:
        parser.error('--chat-id is required; obtain the full group ID from the bot.')
    print('Paste the bot token below. Input is hidden; press Enter when done.', flush=True)
    token = getpass.getpass('Telegram bot token (hidden): ').strip()
    if not re.fullmatch(r'\d+:[A-Za-z0-9_-]{20,}', token):
        raise RuntimeError('Token format is invalid. Nothing was configured.')
    bot = telegram(token, 'getMe')
    print(f'Bot identity verified: @{bot.get("username", "unknown")}.', flush=True)
    if args.discover_chats:
        webhook = telegram(token, 'getWebhookInfo')
        if webhook.get('url'):
            from urllib.parse import urlsplit
            print('Existing webhook host: ' + str(urlsplit(webhook['url']).hostname) + '. Preserved; polling unavailable.')
            return
        updates = telegram(token, 'getUpdates', {'timeout': 0, 'limit': 100})
        groups = {}
        for update in updates:
            for name in ('message', 'my_chat_member', 'chat_member', 'channel_post'):
                chat = update.get(name, {}).get('chat', {})
                if chat.get('type') in ('group', 'supergroup'):
                    groups[str(chat['id'])] = chat.get('title', '')
        print('Group identities visible to the bot: ' + json.dumps(groups, ensure_ascii=True))
        return
    chat = telegram(token, 'getChat', {'chat_id': args.chat_id})
    if chat.get('type') not in ('group', 'supergroup'):
        raise RuntimeError('The supplied destination must be a group or supergroup.')
    member = telegram(token, 'getChatMember', {'chat_id': chat['id'], 'user_id': bot['id']})
    if member.get('status') not in ('administrator', 'creator', 'member'):
        raise RuntimeError('The bot cannot send to this group. Add it to the group first.')
    chat_id = str(chat['id'])
    print(f'Validated bot @{bot.get("username", "unknown")} in group {chat.get("title", "unknown")}.', flush=True)
    # Disable before writing a pair so a partial configuration cannot send to an old destination.
    gh('variable', 'set', 'OPS_TELEGRAM_ENABLED', '--repo', args.repo, value='false')
    gh('secret', 'set', 'OPS_TELEGRAM_BOT_TOKEN', '--repo', args.repo, value=token)
    gh('secret', 'set', 'OPS_TELEGRAM_CHAT_ID', '--repo', args.repo, value=chat_id)
    env = {'OPS_TELEGRAM_ENABLED': 'false', 'OPS_TELEGRAM_BOT_TOKEN': token,
           'OPS_TELEGRAM_CHAT_ID': chat_id}
    command = ['ssh', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
               '-o', 'ConnectTimeout=10', args.host, 'python3 -c ' + shlex.quote(HOST_INSTALL)]
    result = subprocess.run(command, input=json.dumps(env), text=True, capture_output=True, timeout=30)
    if result.returncode:
        raise RuntimeError('GitHub secrets saved; dedicated host configuration failed. Notifications remain disabled.')
    status = {'configured': True, 'enabled': False, 'bot': '@' + bot.get('username', ''),
              'chat_id': chat_id, 'group': chat.get('title', ''), 'repository': args.repo}
    status_path = Path(args.status_file)
    status_path.parent.mkdir(parents=True, exist_ok=True)
    status_path.write_text(json.dumps(status, indent=2), encoding='utf-8')
    print('Credentials saved in GitHub and /etc/xprout-ops.env (root only). No local token file was created.', flush=True)
    print('Setup complete. Notifications will be enabled after implementation checks.', flush=True)


if __name__ == '__main__':
    try:
        main()
    except (Exception, KeyboardInterrupt) as error:
        print('Setup stopped: ' + (str(error) if isinstance(error, RuntimeError) else type(error).__name__), file=sys.stderr)
        sys.exit(1)
