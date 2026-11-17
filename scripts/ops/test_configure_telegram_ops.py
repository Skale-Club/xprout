import contextlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('configure_ops', Path(__file__).with_name('configure-telegram-ops.py'))
setup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(setup)


class ConfigureOpsTests(unittest.TestCase):
    def test_discovery_preserves_existing_webhook_and_does_not_poll(self):
        replies = [{'id': 1, 'username': 'fixturebot'}, {'url': 'https://private.invalid/existing-hook'}]
        with patch.object(setup.sys, 'argv', ['setup', '--discover-chats']), \
                patch.object(setup.getpass, 'getpass', return_value='123:offline_fixture_token_1234567890'), \
                patch.object(setup, 'telegram', side_effect=replies) as telegram, \
                patch.object(setup, 'gh') as gh, contextlib.redirect_stdout(io.StringIO()) as output:
            setup.main()
            self.assertEqual([call.args[1] for call in telegram.call_args_list], ['getMe', 'getWebhookInfo'])
            self.assertNotIn('https://private.invalid/existing-hook', output.getvalue())
            gh.assert_not_called()

    def test_token_only_travels_in_stdin_and_status_contains_no_secret(self):
        token = '123456:offline_fixture_token_1234567890'
        replies = [{'id': 1, 'username': 'fixturebot'}, {'id': -1002, 'type': 'supergroup', 'title': 'Fixture ops'}, {'status': 'administrator'}]
        with tempfile.TemporaryDirectory() as directory:
            status_path = Path(directory) / 'status.json'
            with patch.object(setup.sys, 'argv', ['setup', '--chat-id=-1002', '--status-file', str(status_path)]), \
                    patch.object(setup.getpass, 'getpass', return_value=token), \
                    patch.object(setup, 'telegram', side_effect=replies), \
                    patch.object(setup, 'gh') as gh, \
                    patch.object(setup.subprocess, 'run', return_value=SimpleNamespace(returncode=0)) as run, \
                    contextlib.redirect_stdout(io.StringIO()) as output:
                setup.main()
            self.assertNotIn(token, output.getvalue())
            self.assertNotIn(token, status_path.read_text())
            self.assertEqual(json.loads(status_path.read_text())['chat_id'], '-1002')
            self.assertEqual(gh.call_args_list[0].kwargs['value'], 'false')
            self.assertNotIn(token, ' '.join(run.call_args.args[0]))
            self.assertEqual(json.loads(run.call_args.kwargs['input'])['OPS_TELEGRAM_ENABLED'], 'false')
            self.assertEqual(json.loads(run.call_args.kwargs['input'])['OPS_TELEGRAM_BOT_TOKEN'], token)

    def test_invalid_token_never_calls_network_or_writes(self):
        with patch.object(setup.sys, 'argv', ['setup', '--chat-id=-1002']), \
                patch.object(setup.getpass, 'getpass', return_value='invalid'), \
                patch.object(setup, 'telegram') as telegram, \
                patch.object(setup, 'gh') as gh, contextlib.redirect_stdout(io.StringIO()):
            with self.assertRaises(RuntimeError):
                setup.main()
            telegram.assert_not_called()
            gh.assert_not_called()

    def test_private_chat_rejected_before_any_configuration(self):
        replies = [{'id': 1}, {'id': 2, 'type': 'private'}]
        with patch.object(setup.sys, 'argv', ['setup', '--chat-id=-1002']), \
                patch.object(setup.getpass, 'getpass', return_value='123:offline_fixture_token_1234567890'), \
                patch.object(setup, 'telegram', side_effect=replies), \
                patch.object(setup, 'gh') as gh, contextlib.redirect_stdout(io.StringIO()):
            with self.assertRaises(RuntimeError):
                setup.main()
            gh.assert_not_called()


if __name__ == '__main__':
    unittest.main()
