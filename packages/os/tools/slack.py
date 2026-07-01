"""slack tools — post messages via webhook."""

import json
import os
import urllib.request

SLACK_WEBHOOK_URL = os.environ.get("SLACK_WEBHOOK_URL", "")


def post(message: str, channel: str = "#suelo") -> str:
    """post a message to slack."""
    if not SLACK_WEBHOOK_URL:
        return json.dumps({"error": "SLACK_WEBHOOK_URL not set"})
    body = json.dumps({"text": message}).encode()
    req = urllib.request.Request(SLACK_WEBHOOK_URL, data=body, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as resp:
            return json.dumps({"posted": True})
    except urllib.error.HTTPError as e:
        return json.dumps({"error": f"{e.code} {e.read().decode()[:200]}"})
