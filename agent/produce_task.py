#!/usr/bin/env python3
"""
Simple agent demo that posts a "task" to the backend task API.

Usage:
  BACKEND_URL=http://localhost:8000 python agent/produce_task.py
"""

import os
import uuid
import json
import requests
from datetime import datetime

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000").rstrip("/")

def make_candidates():
    uid = str(uuid.uuid4())[:8]
    return [
        {"id": f"{uid}-p1", "text": "Short announcement: We shipped feature X! Check it out."},
        {"id": f"{uid}-p2", "text": "Thread idea: 1) problem 2) approach 3) result — a shareable story."},
        {"id": f"{uid}-p3", "text": "Playful hook: 'We just made a thing that will save you time.'"}
    ]

def make_payload():
    return {
        "source": "social-agent-demo",
        "source_url": "https://example.com/demo-article",
        "candidates": make_candidates(),
        "suggested_images": [
            {"type": "gen", "prompt": "abstract hero image, bright colors, modern tech"}
        ],
        "meta": {
            "created_at": datetime.utcnow().isoformat() + "Z",
            "note": "demo task from agent/produce_task.py"
        }
    }

def create_task(payload):
    url = f"{BACKEND_URL}/api/tasks"
    headers = {"Content-Type": "application/json"}
    # Backend expects the payload wrapped in a "payload" field
    request_body = {"payload": payload}
    try:
        r = requests.post(url, json=request_body, headers=headers, timeout=10)
        r.raise_for_status()
    except requests.HTTPError as e:
        print("ERROR: failed to POST task to backend:", e)
        # Print the error details from the server
        try:
            error_detail = r.json()
            print("Server error details:", json.dumps(error_detail, indent=2))
        except (ValueError, AttributeError):
            print("Server response:", r.text)
        raise
    except requests.RequestException as e:
        print("ERROR: failed to POST task to backend:", e)
        raise
    try:
        return r.json()
    except ValueError:
        return {"raw_text": r.text}

def main():
    payload = make_payload()
    print("Posting task to backend:", BACKEND_URL)
    print(json.dumps(payload, indent=2)[:1000])  # short preview
    resp = create_task(payload)
    print("Backend response:", json.dumps(resp, indent=2))

if __name__ == "__main__":
    main()
