# Quiz Platform

A highly scalable real-time quiz platform designed to support:

* 10,000+ concurrent participants
* Real-time leaderboards
* Email OTP authentication
* Admin-managed quizzes
* Automatic quiz scheduling
* No submission loss guarantees
* Event-driven architecture
* Horizontally scalable services

---

# Goals

## Functional Requirements

### Admin

* Create quizzes
* Edit quizzes while in Draft state
* Schedule quiz start/end times
* Generate shareable quiz links
* Configure quiz access passwords
* Invite participants via email
* View quiz analytics
* View participant submission history
* View participant scores
* Manually trigger invitation emails

### Participants

* Join quiz using URL
* Verify email using OTP
* Enter waiting room before quiz start
* Participate in quiz
* Submit answers
* View leaderboard
* Receive result email after quiz completion

---

# Non Functional Requirements

* Support 10,000+ concurrent participants
* Support burst submission traffic
* No submission loss
* High availability
* Horizontal scalability
* Eventual consistency
* Real-time leaderboard updates
* Auditability
* Fault tolerance

---

# Architecture Overview

```text
                    +------------------+
                    |  Admin Frontend  |
                    +------------------+
                             |
                             |
                    +------------------+
                    | Player Frontend  |
                    +------------------+
                             |
                             |
                             V

                    +------------------+
                    |  Fastify API     |
                    +------------------+

                             |
               --------------------------------
               |              |              |
               V              V              V

           PostgreSQL      Redis       RabbitMQ
             Primary      Cluster      Cluster

                                            |
                       ------------------------------------
                       |          |          |           |
                       V          V          V           V

                  Scoring    Analytics   Email    Leaderboard
                   Worker      Worker    Worker      Worker

                       |          |          |
                       V          V          V

                  PostgreSQL  ClickHouse   SMTP

                                            |
                                            V

                                   WebSocket Gateway
```

---

# Technology Stack

## Backend

* Node.js
* TypeScript
* Fastify

## Database

* PostgreSQL

## Cache

* Redis

## Messaging

* RabbitMQ

## Analytics

* ClickHouse

## Frontend

* Next.js

## Realtime

* WebSockets

## Containerization

* Docker

## Orchestration

* Kubernetes

---

# Domain Model

## Quiz

```text
Quiz
├── Questions
├── Schedule
├── Password
├── State
└── Settings
```

States:

```text
Draft
Scheduled
Live
Completed
Archived
```

---

## Participant

```text
Participant
├── Name
├── Email
├── OTP Verification
└── Quiz Participation
```

---

## Submission

```text
Submission
├── Answers
├── Score
├── Completion Time
└── Status
```

---

# Quiz Lifecycle

## Draft

Admin may:

* Add questions
* Remove questions
* Edit questions
* Change timings

## Live

Admin cannot modify:

* Questions
* Answers
* Quiz settings

Admin must restart quiz to make changes.

## Completed

Quiz becomes immutable.

---

# Submission Processing

## Submission Endpoint

```http
POST /quizzes/:id/submit
```

Flow:

```text
Client
   |
   V

API

BEGIN TRANSACTION

INSERT submission

INSERT outbox_event

COMMIT

Return 202 Accepted
```

Response:

```json
{
  "submissionId": "uuid",
  "status": "processing"
}
```

---

# Duplicate Submission Prevention

Database-level constraint:

```sql
CREATE UNIQUE INDEX
uq_quiz_participant
ON submissions(
  quiz_id,
  participant_id
);
```

Guarantees:

* One submission per participant
* No race conditions
* No Redis dependency

---

# Transactional Outbox Pattern

Purpose:

Guarantee event delivery.

Within same transaction:

```text
INSERT submission
INSERT outbox_event
COMMIT
```

If RabbitMQ is unavailable:

```text
Submission persists
Outbox persists
```

No data loss.

---

# Outbox Relay

Runs independently.

```sql
SELECT *
FROM outbox_events
WHERE published = false
FOR UPDATE SKIP LOCKED;
```

Flow:

```text
Outbox
   |
   V

RabbitMQ

Publisher Confirm

Mark Published
```

---

# RabbitMQ Topology

## Exchange

```text
quiz.events
```

Type:

```text
topic
```

Routing Keys:

```text
submission.received
submission.scored
email.send
leaderboard.updated
```

---

# Submission Scoring

Queue:

```text
quiz.submissions.scoring
```

Worker Flow:

```text
Consume

Calculate Score

Calculate Time

Update Submission

Insert Outbox Event

ACK
```

Worker is idempotent.

---

# Event Flow

```text
submission.received
         |
         V

   Scoring Worker

         |
         V

submission.scored

         |
     ----|----
     |   |   |
     V   V   V

Leaderboard
Analytics
Email
```

---

# Leaderboard Architecture

Redis Sorted Set:

```text
leaderboard:{quizId}
```

Update:

```redis
ZADD leaderboard:{quizId}
```

Read:

```redis
ZREVRANGE leaderboard:{quizId}
```

Ranking:

```text
Highest Score
Lowest Completion Time
```

---

# Realtime Updates

Worker:

```text
submission.scored
       |
       V

Redis Pub/Sub
```

WebSocket Gateway:

```text
Subscribe

Fetch Top N

Broadcast
```

Clients receive leaderboard updates in real time.

---

# Waiting Room

Redis Set:

```text
quiz:{id}:waiting-room
```

Stores:

```text
participant_id
joined_at
```

Benefits:

* Fast joins
* No database load
* Presence tracking

---

# Analytics

Analytics are isolated from transactional workloads.

Flow:

```text
submission.scored
       |
       V

Analytics Worker
       |
       V

ClickHouse
```

Admin analytics never query PostgreSQL directly.

---

# Email Service

Events:

```text
email.send
```

Worker:

```text
Consume Event

Send Email

Mark Delivered
```

Email Types:

* OTP Verification
* Quiz Invitation
* Quiz Results

---

# Database Tables

## quizzes

```text
id
title
description
password
start_time
end_time
status
created_at
updated_at
```

---

## questions

```text
id
quiz_id
question
type
options
correct_answer
```

---

## participants

```text
id
name
email
verified
created_at
```

---

## submissions

```text
id
quiz_id
participant_id
answers_jsonb
score
time_taken_ms
status
submitted_at
```

---

## outbox_events

```text
id
event_type
payload
published
created_at
```

---

# Scaling Strategy

## API Layer

Horizontal scaling.

```text
API Pod x N
```

Load balanced.

---

## Workers

Horizontal scaling.

```text
Scoring Worker x N
Analytics Worker x N
Email Worker x N
```

---

## PostgreSQL

* Primary node
* Read replicas
* Partitioned submissions table

---

## Redis

Cluster mode.

Used for:

* Leaderboards
* Waiting rooms
* WebSocket fanout

---

## RabbitMQ

3-node cluster.

Features:

* Quorum queues
* Publisher confirms
* Dead letter queues

---

# Failure Handling

## RabbitMQ Down

Submission still stored.

Outbox relay retries.

---

## Worker Crash

Message not acknowledged.

RabbitMQ redelivers.

---

## Email Failure

Message retried.

Dead-letter queue after threshold.

---

## Redis Failure

Leaderboards rebuildable from submissions.

No submission loss.

---

# Security

* JWT Authentication
* OTP Email Verification
* Quiz Access Passwords
* Admin RBAC
* Audit Logging
* Rate Limiting
* Input Validation (Zod)

---

# Future Improvements

* Multi-region deployment
* Redis Streams
* PostgreSQL LISTEN/NOTIFY
* Materialized analytics views
* Anti-cheat detection
* Device fingerprinting
* OpenTelemetry tracing
* Event sourcing for audit trails

---

# Architecture Principles

1. PostgreSQL is the source of truth.
2. Redis is disposable.
3. RabbitMQ provides asynchronous decoupling.
4. Outbox pattern guarantees delivery.
5. Workers must be idempotent.
6. Analytics never impact transactional workloads.
7. Leaderboards are eventually consistent.
8. No submission loss is acceptable.
