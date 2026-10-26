from collections import deque
from datetime import datetime, timezone

EVENTS=deque(maxlen=200)


def record_event(kind, message, status=None):
    EVENTS.appendleft({'at':datetime.now(timezone.utc).isoformat(), 'kind':kind, 'message':message, 'status':status})
