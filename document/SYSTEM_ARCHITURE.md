# Confeet Chat & Call Ecosystem: System Architecture & Design Specification

> **Target Audience:** Developers, System Architects, and AI / LLM Context Interpreters.  
> **Repository:** `btc-chat`  
> **Last Updated:** September 2026

---

## 1. Executive Overview

The **Confeet Chat & Call Ecosystem** is a distributed, high-throughput, low-latency communication platform providing:
1. **Real-time 1:1 and Group Instant Messaging** (with sequencing, persistence, delivery receipts, and reactions).
2. **WebRTC Audio & Video Calling / Conferencing** (targeted signaling, peer-to-peer and SFU/MCU mesh readiness, invite/join requests, call timeouts, and ring orchestration).
3. **Presence & User State Management** (online/offline status, activity heartbeats, dynamic gateway location mapping).
4. **Reliable Push Notifications** (smart delivery to offline users via FCM/APNs based on live presence state).

The platform adopts a hybrid **Event-Driven & Microservices Architecture** combining **WebSockets**, **gRPC**, **Apache Kafka**, **NATS JetStream**, **Redis**, and **MongoDB**.

```mermaid
flowchart TD
    Client["Client Applications (Web / Angular / Mobile)"]

    subgraph Ingress ["1. Ingress & Connection Layer"]
        APIGW["btc-apigateway-service (Port 8080)<br/>• Reverse Proxy & TLS<br/>• JWT Authentication"]
        WSGW["btc-websocket-gateway-service (Port 8000)<br/>• Stateful WebSocket Hub<br/>• Sharded Client Registry<br/>• Event Router"]
    end

    subgraph CoreServices ["2. Core Microservices"]
        MSG["btc-message-service (gRPC Port 50051)<br/>• Sequencer & Message Business Logic<br/>• Conversation & Group Engine"]
        PRESENCE["btc-presence-service (gRPC Port 50052)<br/>• User Status & Session Registry<br/>• WebRTC Call Signaling Router"]
        RELAY["btc-relay-service<br/>• Kafka to NATS Bridge<br/>• Event Envelope Serialization"]
        NOTIF["btc-notification-service<br/>• Push Dispatcher (FCM / APNs)<br/>• Smart Presence Suppression"]
    end

    subgraph Storage ["3. Data & Messaging Infrastructure"]
        MONGO[("MongoDB<br/>• Messages & Conversations<br/>• User Profiles & Devices")]
        REDIS[("Redis Cache<br/>• User Presence State<br/>• User -> Gateway Routing Keys")]
        KAFKA[("Apache Kafka Cluster<br/>• Persistent Event Log<br/>• Topic: chat-events")]
        NATS[("NATS JetStream<br/>• Sub-millisecond Pub/Sub<br/>• Targeted Gateway Queues")]
    end

    Client <-->|WSS / HTTPS| APIGW
    APIGW <-->|Proxy| WSGW
    WSGW -->|gRPC| MSG
    WSGW -->|gRPC / Status| PRESENCE
    MSG -->|Write / Read| MONGO
    MSG -->|Publish Event| KAFKA
    
    KAFKA -->|Consume| RELAY
    RELAY -->|Publish| NATS
    NATS -->|Broadcast / Queue| WSGW
    
    WSGW -.->|Queue Publish| NATS
    NATS -.->|Targeted Update| WSGW
    
    KAFKA -->|Consume| NOTIF
    NOTIF -->|Presence Check| REDIS
    NOTIF -->|Device Tokens| MONGO
    
    PRESENCE <-->|Fast Lookup & Session Tracking| REDIS
    PRESENCE <-->|Metadata| MONGO
```

---

## 2. Microservice Inventory & Responsibilities

| Service Name | Directory | Primary Role | Protocols / Interfaces | Backing Stores |
|---|---|---|---|---|
| **`btc-apigateway-service`** | `btc-apigateway-service/` | Edge reverse proxy, SSL termination, route validation, token parsing. | HTTP/1.1, WebSocket Proxy (Port 8080) | None (Stateless) |
| **`btc-websocket-gateway-service`** | `btc-websocket-gateway-service/` | Maintains persistent client WebSockets, executes sharded memory routing, dispatches inbound frames, and ingests NATS events. | WebSocket (Port 8000), gRPC Client, NATS Subscriber | In-memory Sharded Registry |
| **`btc-message-service`** | `btc-message-service/` | Chat persistence engine, per-conversation monotonic sequence generation, conversation member access checks. | gRPC Server (Port 50051), Kafka Producer | MongoDB (`chat_db`) |
| **`btc-presence-service`** | `btc-presence-service/` | User presence state tracking, heartbeat monitoring, and WebRTC call signaling route calculation. | gRPC Server (Port 50052), NATS Consumer / Publisher | Redis (`presence_db`), MongoDB |
| **`btc-relay-service`** | `btc-relay-service/` | Bridges high-durability Kafka chat event logs into real-time NATS JetStream pub/sub. | Kafka Consumer, NATS Publisher | None (Stateless Stream Bridge) |
| **`btc-notification-service`** | `btc-notification-service/` | Evaluates message recipients, checks live presence in Redis, and pushes notifications to APNs/FCM if offline. | Kafka Consumer, HTTP (Push Provider APIs) | Redis (Presence read), MongoDB (Device Tokens) |
| **`btc-grpc`** | `btc-grpc/` | Protobuf definitions (`.proto`) and compiled Go stubs for inter-service communication. | Protobuf / gRPC definitions | N/A |
| **`btc-schema-script`** | `btc-schema-script/` | Database setup scripts, MongoDB collection indexes, migrations. | Bash / Node / Mongo Shell | MongoDB schema definitions |

---

## 3. Communication & Data Topology

### 3.1 Synchronous vs. Asynchronous Communication
* **Synchronous (gRPC)**:
  * Used on the **inbound write path**: WebSocket Gateway $\xrightarrow{\text{gRPC}}$ Message Service / Presence Service.
  * Ensures immediate validation, authorization, and sequence numbering before acknowledging receipt to the sender.
* **Asynchronous (Kafka & NATS)**:
  * **Kafka**: Durable write log for chat messages and notifications (guaranteed at-least-once persistence, replayability).
  * **NATS JetStream**: High-speed fan-out and targeted push notifications from backend microservices back to the distributed WebSocket Gateway instances.

### 3.2 NATS Subject & Queue Group Conventions
* **Chat Broadcast**: `chat.event.broadcast`  
  * Used for broadcasting global/chat events across gateways.
  * Consumed by `btc-presence-service` via Queue Group `btc-presence-queue-group`.
* **Call Signaling Broadcast**: `call.event.broadcast`  
  * Used by WebSocket Gateway to dispatch WebRTC call events (`call:initiate`, `call:accept`, `call:reject`, etc.) to the Presence orchestrator.
  * Consumed by `btc-presence-service` via Queue Group `btc-call-signaling-queue-group`.
* **Targeted Gateway Dispatch**: `chat.event.update.notify.<gateway_instance_id>`  
  * Used by `btc-presence-service` to deliver targeted WebRTC signaling and presence updates **directly** to the exact Gateway instance holding the recipient's socket ($O(1)$ delivery, no global fan-out).

### 3.3 Redis Keyspace Design
* `user:gateway:<userId>` $\rightarrow$ `string` (Gateway Instance ID, e.g., `"ws-gw-pod-01"`). TTL: 120s (refreshed by socket heartbeat).
* `presence:status:<userId>` $\rightarrow$ `string` (`"online"`, `"offline"`, `"busy"`).
* `presence:heartbeat:<userId>` $\rightarrow$ `timestamp`. TTL: 60s.
* `call:active:<conversationId>` $\rightarrow$ `hash` (Call session metadata, initiator ID, participant states, start timestamp).

### 3.4 MongoDB Collections (`chat_db`)
* `messages`: Message payloads, timestamps, monotonic `sequence_id`, sender ID, conversation ID, attachments, delivery/read statuses.
* `conversations`: Conversation ID, type (`direct` / `group`), member array, admin IDs, last message snapshot, created/updated timestamps.
* `conversation_sequences`: Atomic sequence counters per conversation (`_id: conversationId`, `current_seq: int64`).
* `user_devices`: User ID, FCM/APNs push tokens, device platform (`ios`, `android`, `web`), last active timestamp.

---

## 4. End-to-End Core Workflows

### 4.1 Workflow A: Client Connection, Authentication & Presence Setup

```mermaid
sequenceDiagram
    autonumber
    actor Client as User (Client App)
    participant APIGW as btc-apigateway-service
    participant WSGW as btc-websocket-gateway-service
    participant Redis as Redis Cache
    participant NATS as NATS JetStream

    Client->>APIGW: HTTP Upgrade GET /ws?token=JWT
    APIGW->>APIGW: Validate JWT & Claims (extract userId)
    APIGW->>WSGW: Proxy WebSocket Connection (with X-User-Id header)
    WSGW->>WSGW: Client Connects (assign clientId, spawn Read/Write goroutines)
    WSGW->>WSGW: Register in Hub Memory (user_map & client_map)
    WSGW->>Redis: SET user:gateway:<userId> = <gatewayInstanceId> (TTL 120s)
    WSGW->>Redis: SET presence:status:<userId> = "online"
    WSGW->>NATS: Publish presence:online event to chat.event.broadcast
    WSGW-->>Client: WebSocket Connected ACK (heartbeat interval: 30s)

    loop Heartbeat / Keepalive
        Client->>WSGW: Ping {"type": "ping"}
        WSGW->>Redis: EXPIRE user:gateway:<userId> 120s
        WSGW-->>Client: Pong {"type": "pong"}
    end
```

---

### 4.2 Workflow B: Real-Time Chat Message Lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor Alice as Alice (Sender)
    participant WSGW_A as WebSocket Gateway A
    participant MSG as btc-message-service (gRPC)
    participant Mongo as MongoDB
    participant Kafka as Kafka (Topic: chat-events)
    participant Relay as btc-relay-service
    participant NATS as NATS JetStream
    participant WSGW_B as WebSocket Gateway B
    actor Bob as Bob (Online Recipient)
    participant Notif as btc-notification-service
    participant Redis as Redis Presence
    actor Charlie as Charlie (Offline Recipient)

    Alice->>WSGW_A: WS send_message {conversationId, text}
    WSGW_A->>MSG: gRPC ProcessEvent(WsEventRequest)
    MSG->>Mongo: FindAndModify (Atomic Increment sequence_id)
    MSG->>Mongo: Insert Message Document (status: PERSISTED)
    MSG->>Kafka: Produce Event Envelope {conversationId, message, sequence_id}
    MSG-->>WSGW_A: gRPC Response OK {messageId, sequence_id, timestamp}
    WSGW_A-->>Alice: WS ACK message_sent {clientMsgId, serverMsgId, sequence_id}

    par Real-time Online Delivery
        Kafka->>Relay: Consume chat-events
        Relay->>NATS: Publish to chat.event.broadcast
        NATS->>WSGW_B: Broadcast Message Event
        WSGW_B->>WSGW_B: Lookup Bob in local Hub ClientMap
        WSGW_B-->>Bob: WS new_message {message, sequence_id}
        Bob->>WSGW_B: WS read_receipt {messageId}
    and Offline Push Notification
        Kafka->>Notif: Consume chat-events
        Notif->>Redis: Check Presence for Charlie (GET presence:status:Charlie)
        Redis-->>Notif: "offline" / Key Not Found
        Notif->>Mongo: Get Charlie's FCM / APNs Device Tokens
        Notif->>Charlie: Send Mobile Push Notification (FCM / APNs)
    end
```

---

### 4.3 Workflow C: Targeted WebRTC Audio/Video Call Signaling

This workflow uses **Targeted NATS Dispatch** ($O(1)$ Gateway Routing) to avoid broadcasting WebRTC SDP packets and ICE candidates to all connected servers.

```mermaid
sequenceDiagram
    autonumber
    actor Caller as Alice (Caller)
    participant WSGW_A as Gateway A (Alice's Node)
    participant NATS as NATS JetStream
    participant Presence as btc-presence-service
    participant Redis as Redis Cache
    participant WSGW_B as Gateway B (Bob's Node)
    actor Callee as Bob (Callee)

    Caller->>WSGW_A: WS call:initiate {conversationId, calleeIds: ["Bob"], isGroup: false, callerName, callerEmail}
    WSGW_A->>NATS: PublishOnQueue("call.event.broadcast", payload)
    NATS->>Presence: Consume (via btc-call-signaling-queue-group)
    
    Presence->>Redis: HSET call:active:<conversationId> {caller: "Alice", status: "RINGING"}
    Presence->>Redis: GET user:gateway:Bob
    Redis-->>Presence: "ws-gateway-node-b"
    
    Presence->>NATS: Publish to "chat.event.update.notify.ws-gateway-node-b"<br/>{event: "call:incoming", callerId: "Alice", callerName: "Alice", watcher_ids: ["Bob"]}
    NATS->>WSGW_B: Deliver directly to Gateway B
    WSGW_B->>WSGW_B: Lookup Bob in Client Registry
    WSGW_B-->>Callee: WS call:incoming {conversationId, callerId: "Alice", callerName, callerEmail}

    opt Callee Accepts Call
        Callee->>WSGW_B: WS call:accept {conversationId, callerId: "Alice"}
        WSGW_B->>NATS: PublishOnQueue("call.event.broadcast", call:accept)
        NATS->>Presence: Consume call:accept
        Presence->>Redis: GET user:gateway:Alice -> "ws-gateway-node-a"
        Presence->>NATS: Publish to "chat.event.update.notify.ws-gateway-node-a"<br/>{event: "call:accepted", acceptedBy: "Bob", watcher_ids: ["Alice"]}
        NATS->>WSGW_A: Deliver to Gateway A
        WSGW_A-->>Caller: WS call:accepted {conversationId, acceptedBy: "Bob"}
        
        Note over Caller, Callee: WebRTC Peer Connection Exchange (call:offer -> call:answer -> call:ice-candidate)
    end

    opt Callee Rejects Call
        Callee->>WSGW_B: WS call:reject {conversationId, callerId: "Alice"}
        WSGW_B->>NATS: PublishOnQueue("call.event.broadcast", call:reject)
        NATS->>Presence: Consume call:reject
        Presence->>Redis: GET user:gateway:Alice -> "ws-gateway-node-a"
        Presence->>NATS: Publish to "chat.event.update.notify.ws-gateway-node-a"<br/>{event: "call:rejected", rejectedBy: "Bob", watcher_ids: ["Alice"]}
        NATS->>WSGW_A: Deliver to Gateway A
        WSGW_A-->>Caller: WS call:rejected {conversationId, rejectedBy: "Bob"}
    end
```

---

## 5. Directory Structure & Key Files

```plaintext
btc-chat/
├── btc-apigateway-service/          # Ingress API Gateway (Go)
│   ├── cmd/server/main.go           # Entry point, router & proxy handlers
│   └── internal/middleware/auth.go  # JWT extraction & validation
│
├── btc-websocket-gateway-service/   # Real-time WebSocket Gateway (Go)
│   ├── cmd/server/main.go           # Gateway init, metrics, signals
│   └── internal/
│       ├── clients/
│       │   └── client.go            # WS connection, ReadPump / WritePump goroutines
│       ├── hub/
│       │   ├── hub.go               # Sharded connection map & worker pool
│       │   ├── registry.go          # Event handler dispatcher registry
│       │   ├── nats-consumer.go     # Subscribes to broadcast & targeted gateway subjects
│       │   ├── message-grpc.go      # gRPC client to Message Service
│       │   └── handlers/
│       │       ├── handler_message.go   # Handles chat messages & receipts
│       │       ├── handler_call.go      # Handles WebRTC call signaling routing
│       │       └── handler_presence.go  # Handles user status & ping events
│       └── event/
│           ├── call_events.go       # WebRTC signaling payload definitions
│           └── event.go             # Generic WebSocket event envelopes
│
├── btc-presence-service/            # Presence & Call Signaling Service (Go)
│   ├── cmd/server/main.go           # Service init, NATS consumers start
│   └── internal/
│       ├── consumer/
│       │   ├── presence_consumer.go        # Listens on chat.event.broadcast
│       │   └── call_signaling_consumer.go  # Listens on call.event.broadcast
│       └── handlers/
│           ├── handle_presence.go          # Updates Redis status & heartbeats
│           └── handle_call_signaling.go    # Targeted recipient resolution & dispatch
│
├── btc-message-service/             # Core Chat Engine (Go)
│   ├── cmd/server/main.go           # gRPC server setup
│   └── internal/
│       ├── grpc/service.go          # ProcessEvent implementation
│       ├── repository/mongo.go      # MongoDB conversation & message queries
│       └── producer/kafka.go        # Publishes persisted messages to Kafka
│
├── btc-relay-service/               # Kafka -> NATS Bridge (Go)
│   ├── cmd/server/main.go           # Consumer group initialization
│   └── internal/relay/relay.go      # Consumes Kafka topic and forwards to NATS JetStream
│
├── btc-notification-service/        # Push Notification Engine (Go)
│   ├── cmd/server/main.go           # Push worker daemon
│   └── internal/push/dispatcher.go  # Redis presence check & FCM/APNs dispatch
│
├── btc-grpc/                        # Protocol Buffers & Generated Code
│   ├── protos/
│   │   ├── message.proto            # Chat gRPC service definitions
│   │   └── presence.proto           # Presence gRPC service definitions
│   └── gen/go/                      # Generated Go structs and interfaces
│
└── documents/                       # Architecture & Technical Documentation
    ├── CHAT_END_TO_END_FLOW.md       # In-depth chat message path
    └── SYSTEM_ARCHITECTURE_AND_WORKFLOW.md # (This File) Master Architecture Guide
```

---

## 6. Event Specification Contracts

### 6.1 Chat WebSocket Event Contract
```json
{
  "event": "send_message",
  "payload": {
    "conversation_id": "conv_67890",
    "client_msg_id": "uuid-v4-client-id",
    "text": "Hello, world!",
    "type": "text",
    "attachments": []
  }
}
```

### 6.2 WebRTC Call Initiate Contract (`call:initiate`)
```json
{
  "event": "call:initiate",
  "payload": {
    "conversation_id": "conv_67890",
    "caller_id": "USR001",
    "caller_name": "Alice Smith",
    "caller_email": "alice@confeet.com",
    "callee_ids": ["USR002"],
    "is_group": false,
    "call_type": "audio",
    "timeout": 120
  }
}
```

### 6.3 WebRTC Call Incoming Delivery Contract (`call:incoming`)
```json
{
  "event": "call:incoming",
  "payload": {
    "conversation_id": "conv_67890",
    "caller_id": "USR001",
    "caller_name": "Alice Smith",
    "caller_email": "alice@confeet.com",
    "is_group": false,
    "call_type": "audio",
    "timestamp": 1790260318000
  }
}
```

### 6.4 WebRTC SDP Negotiation Contracts (`call:offer`, `call:answer`, `call:ice-candidate`)
```json
{
  "event": "call:offer",
  "payload": {
    "conversation_id": "conv_67890",
    "caller_id": "USR001",
    "receiver_id": "USR002",
    "sdp": "v=0\r\no=- 461173... IN IP4 0.0.0.0\r\ns=-\r\nt=0 0\r\n...",
    "type": "offer"
  }
}
```

---

## 7. Architectural Guardrails & Resilience Principles

1. **Targeted Signaling & Fan-Out Elimination**:
   * Signaling events are never broadcast globally to all gateways. Instead, `btc-presence-service` looks up the recipient's gateway in Redis (`user:gateway:<userId>`) and dispatches strictly to `chat.event.update.notify.<gateway_instance_id>`.
2. **Infinite Self-Loop Prevention**:
   * All NATS consumers enforce `if msg.SourceInstance == "presence-service" { return }` on broadcast listeners to prevent an event from looping back infinitely.
3. **Queue Group Load Balancing**:
   * Background listeners subscribe with NATS Queue Groups (`btc-presence-queue-group`, `btc-call-signaling-queue-group`). If 5 replicas of `btc-presence-service` are running, each event is handled by exactly **one** instance.
4. **Lightweight Concurrency**:
   * WebSockets use Go's lightweight runtime scheduler (~2KB per goroutine). A server with 50 connected users will display ~100 parked goroutines (`runtime.gopark`), which is optimal and uses negligible memory.
5. **Stateful Gateway Isolation**:
   * The WebSocket Gateway is stateless regarding long-term storage, keeping only connection handles in memory. Any gateway crash only prompts clients to reconnect and re-register their `user:gateway:<id>` key in Redis automatically.
