#!/usr/bin/env python3
"""Send dedicated Xprout host/container alerts without changing shared watchdog recipients."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time

PROJECT = 'gmaayluj11x1m6j7baogonfn'


def memory_metrics(text):
    values = {}
    for line in text.splitlines():
        parts = line.split()
        if len(parts) >= 2:
            values[parts[0].rstrip(':')] = int(parts[1])
    total = values['MemTotal']
    if total <= 0 or 'MemAvailable' not in values:
        raise ValueError('memory metrics unavailable')
    swap_total = values.get('SwapTotal', 0)
    return {'memory': (total - values['MemAvailable']) * 100 / total,
            'swap': (swap_total - values.get('SwapFree', 0)) * 100 / swap_total if swap_total else 0,
            'total_bytes': total * 1024}


def evaluate(metrics, containers, now):
    problems = {}
    for key, threshold, label in [('disk', 85, 'Host disk'), ('memory', 90, 'Host memory'), ('swap', 50, 'Host swap')]:
        if metrics[key] >= threshold:
            problems[key] = f'{label} is at {metrics[key]:.1f}% (threshold {threshold}%).'
    # Docker lists newest first. Prefer a live container, since an old stopped
    # deployment must not page after a successful replacement.
    live = [c for c in containers if c['state'].get('Running') or c['state'].get('Restarting')]
    current = (live or containers or [None])[0]
    if current is None:
        problems['container'] = 'No Xprout app container exists in its reviewed Compose project.'
    else:
        state = current['state']
        # A short deployment grace period avoids reporting normal health startup.
        started = state.get('StartedAt', '')
        try:
            from datetime import datetime
            age = now - datetime.fromisoformat(started.replace('Z', '+00:00')).timestamp()
        except (TypeError, ValueError):
            age = 999999
        if state.get('Restarting'):
            problems['container'] = 'The Xprout app container is restarting.'
        elif not state.get('Running'):
            problems['container'] = 'The Xprout app container is stopped.'
        elif age >= 120 and state.get('Health', {}).get('Status') == 'unhealthy':
            problems['container'] = 'The Xprout app container is unhealthy.'
        used = current.get('memory_bytes', 0)
        share = used * 100 / metrics['total_bytes']
        if share >= 35:
            problems['container-memory'] = f'Xprout holds {used // 1048576} MiB, {share:.1f}% of host RAM (threshold 35%).'
    return problems


def command(args):
    result = subprocess.run(args, capture_output=True, text=True, timeout=15)
    if result.returncode or len(result.stdout) > 262144:
        raise RuntimeError('host command unavailable')
    return result.stdout


def collect(now):
    metrics = memory_metrics(Path('/proc/meminfo').read_text())
    usage = shutil.disk_usage('/')
    metrics['disk'] = usage.used * 100 / usage.total
    ids = command(['docker', 'ps', '-a', '--no-trunc',
                   '--filter', 'label=com.docker.compose.project=' + PROJECT,
                   '--filter', 'label=com.docker.compose.service=app', '--format', '{{.ID}}']).splitlines()[:8]
    containers = []
    for container_id in ids:
        if len(container_id) != 64 or any(c not in '0123456789abcdef' for c in container_id):
            raise RuntimeError('invalid Docker identifier')
        state = json.loads(command(['docker', 'inspect', '--format', '{{json .State}}', container_id]))
        used = 0
        for directory in [Path('/sys/fs/cgroup/system.slice') / ('docker-' + container_id + '.scope'),
                          Path('/sys/fs/cgroup/docker') / container_id]:
            if (directory / 'memory.current').is_file():
                used = int((directory / 'memory.current').read_text())
                swap_path = directory / 'memory.swap.current'
                if swap_path.is_file():
                    used += int(swap_path.read_text())
                break
        containers.append({'state': state, 'memory_bytes': used})
    return evaluate(metrics, containers, now)


def advance(state, problems, now, send):
    """Record acknowledgments only after delivery; keep failed alerts/recoveries retryable."""
    records = {key: dict(value) for key, value in state.get('signals', {}).items()
               if isinstance(key, str) and isinstance(value, dict)}
    for key in sorted(set(records) | set(problems)):
        previous = dict(records.get(key, {}))
        active = key in problems
        was_observed = previous.get('observed', False)
        announced = previous.get('announced', False)
        pending_recovery = previous.get('pending_recovery', False)
        if active:
            due = not announced or now - previous.get('sent_at', 0) >= 21600
            if due and send('⚠ Xprout | Server needs attention\n\n' + problems[key] + '\n\nSource: host watchdog; production.'):
                previous.update(announced=True, sent_at=now)
            previous['pending_recovery'] = False
        elif announced or pending_recovery or was_observed:
            if send('✅ Xprout | Server signal recovered\n\n' + key + ' is back within normal limits.\n\nSource: host watchdog; production.'):
                previous.update(announced=False, sent_at=now, pending_recovery=False)
            else:
                previous['pending_recovery'] = True
        previous['observed'] = active
        if active or previous.get('announced') or previous.get('pending_recovery'):
            records[key] = previous
        else:
            records.pop(key, None)
    return {'version': 1, 'signals': records}


def save(path, value):
    fd, temporary = tempfile.mkstemp(dir=path.parent, prefix='.state-')
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, 'w') as output:
            json.dump(value, output)
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--state', default='/var/lib/xprout-ops/host-state.json')
    args = parser.parse_args()
    if os.environ.get('OPS_TELEGRAM_ENABLED') != 'true':
        print('Xprout host notifications disabled.')
        return
    if os.name != 'posix' or os.geteuid() != 0:
        raise RuntimeError('Run the host watchdog as root on Linux.')
    import fcntl
    state_path = Path(args.state)
    state_path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    with open(state_path.parent / 'host.lock', 'a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return
        spec = importlib.util.spec_from_file_location('telegram_ops', Path(__file__).with_name('telegram-ops.py'))
        ops = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(ops)
        now = time.time()
        try:
            problems = collect(now)
        except Exception:
            problems = {'collector': 'Host checks could not complete. Inspect the watchdog service logs.'}
        try:
            state = json.loads(state_path.read_text())
            if not isinstance(state.get('signals'), dict):
                state = {}
        except (OSError, ValueError, AttributeError):
            state = {}
        updated = advance(state, problems, now, ops.send_message)
        save(state_path, updated)
        print('Xprout host checks completed; active signals: ' + ', '.join(problems.keys()))


if __name__ == '__main__':
    main()
