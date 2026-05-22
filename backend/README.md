# Posture Guard Backend

This backend streams real-time posture metrics to the existing React frontend over WebSocket.

## Install

```bash
cd dbackedn
pip install -r requirements.txt
```

## Run

```bash
uvicorn server:app --host 127.0.0.1 --port 8765
```

Health check:

```text
http://127.0.0.1:8765/health
```

WebSocket endpoint:

```text
ws://127.0.0.1:8765/ws
```

The frontend hook should connect to `ws://127.0.0.1:8765/ws` when mock mode is replaced with the real WebSocket connection.
