import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('host_watchdog', Path(__file__).with_name('telegram-host-watchdog.py'))
host = importlib.util.module_from_spec(spec)
spec.loader.exec_module(host)


class HostWatchdogTests(unittest.TestCase):
    def test_memavailable_and_zero_swap(self):
        self.assertEqual(host.memory_metrics('MemTotal: 100 kB\nMemAvailable: 20 kB\nSwapTotal: 0 kB\nSwapFree: 0 kB'),
                         {'memory': 80, 'swap': 0, 'total_bytes': 102400})

    def test_thresholds_and_old_stopped_container(self):
        metrics = {'disk': 85, 'memory': 90, 'swap': 50, 'total_bytes': 1000}
        containers = [{'state': {'Running': False}}, {'state': {'Running': True, 'Health': {'Status': 'healthy'}}, 'memory_bytes': 350}]
        problems = host.evaluate(metrics, containers, 1000)
        self.assertEqual(set(problems), {'disk', 'memory', 'swap', 'container-memory'})

    def test_missing_and_restarting_container(self):
        metrics = {'disk': 0, 'memory': 0, 'swap': 0, 'total_bytes': 1000}
        self.assertIn('container', host.evaluate(metrics, [], 1000))
        self.assertIn('container', host.evaluate(metrics, [{'state': {'Restarting': True}}], 1000))

    def test_failed_delivery_is_retried_then_deduped(self):
        messages = []
        state = host.advance({}, {'disk': 'full'}, 10, lambda text: False)
        self.assertFalse(state['signals']['disk'].get('announced', False))
        state = host.advance(state, {'disk': 'full'}, 20, lambda text: messages.append(text) or True)
        host.advance(state, {'disk': 'full'}, 30, lambda text: messages.append(text) or True)
        self.assertEqual(len(messages), 1)

    def test_recovery_delivery_is_retried(self):
        state = host.advance({}, {'disk': 'full'}, 10, lambda text: True)
        state = host.advance(state, {}, 20, lambda text: False)
        self.assertTrue(state['signals']['disk']['pending_recovery'])
        state = host.advance(state, {}, 30, lambda text: True)
        self.assertEqual(state['signals'], {})

    def test_cold_healthy_is_silent_and_reminder_is_per_signal(self):
        messages = []
        send = lambda text: messages.append(text) or True
        state = host.advance({}, {}, 0, send)
        self.assertEqual(messages, [])
        state = host.advance(state, {'disk': 'full'}, 1, send)
        state = host.advance(state, {'disk': 'full', 'memory': 'high'}, 10, send)
        self.assertEqual(len(messages), 2)
        host.advance(state, {'disk': 'full', 'memory': 'high'}, 21611, send)
        self.assertEqual(len(messages), 4)


if __name__ == '__main__':
    unittest.main()
