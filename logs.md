### Objective

Move logs off disk. Use stdout → CloudWatch Logs for 30–90 days, auto-archive to S3 via Firehose, and query long-term with Athena. Keep app writes as JSON to stdout (already done).

### Prerequisites

- AWS account and CLI configured.
- Workload type known: ECS/EKS/Elastic Beanstalk/EC2.
- Decide:
  - CloudWatch retention (e.g., 30 or 90 days).
  - S3 bucket name and region for archive.
  - KMS key policy if encrypting (recommended).

### 1) Ship app logs to CloudWatch Logs (stdout)

Pick your environment.

- ECS (Fargate/EC2):
  - Task definition `logConfiguration`:

```json
{
  "logConfiguration": {
    "logDriver": "awslogs",
    "options": {
      "awslogs-group": "/app/weighingapp",
      "awslogs-region": "ap-south-1",
      "awslogs-stream-prefix": "api"
    }
  }
}
```

- Create the log group with retention:

```bash
aws logs create-log-group --log-group-name /app/weighingapp --region ap-south-1 || true
aws logs put-retention-policy --log-group-name /app/weighingapp --retention-in-days 90 --region ap-south-1
```

- EKS:
  - Deploy Fluent Bit DaemonSet with CloudWatch Logs output (AWS for Fluent Bit).
  - Set namespace log group to `/eks/<cluster>/<ns>` and retention via CLI as above.

- Elastic Beanstalk:
  - Enable CW Logs streaming in EB config; set retention on the log group.

- EC2 (systemd/docker):
  - Install/enable CloudWatch Agent to read journald/docker stdout and push to a log group.

Result: all app logs go to a log group (`/app/weighingapp`) in JSON.

### 2) Auto-archive CloudWatch Logs to S3 (Firehose)

- Create S3 bucket (block public access, enable encryption):

```bash
aws s3api create-bucket --bucket my-weighingapp-logs-archive --region ap-south-1 \
  --create-bucket-configuration LocationConstraint=ap-south-1
```

- Enable default encryption (SSE-S3 or SSE-KMS):

```bash
aws s3api put-bucket-encryption --bucket my-weighingapp-logs-archive --server-side-encryption-configuration '{
  "Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]
}'
```

- Add lifecycle (Standard → IA in 30–60d → Glacier in 180d; optional expiration):

```bash
aws s3api put-bucket-lifecycle-configuration --bucket my-weighingapp-logs-archive --lifecycle-configuration '{
  "Rules":[
    {"ID":"transition","Status":"Enabled",
     "Filter":{"Prefix":""},
     "Transitions":[{"Days":60,"StorageClass":"STANDARD_IA"},{"Days":180,"StorageClass":"GLACIER"}]
    }
  ]
}'
```

- Create Firehose delivery stream (directly from CloudWatch Logs).
  - In Console → Kinesis Data Firehose → Create
    - Source: Direct PUT or other sources → “CloudWatch Logs”
    - Destination: S3 (bucket above)
    - S3 prefix: logs/!{timestamp:yyyy}/!{timestamp:MM}/!{timestamp:dd}/
    - Buffering: 1–5 min or 1–5 MB
    - Compression: GZIP
    - Enable dynamic partitioning (optional).
- Create CW Logs subscription to Firehose:
  - Console → CloudWatch Logs → Log groups → `/app/weighingapp` → Subscription filters → “Create subscription” → Destination “Kinesis Data Firehose” → choose stream. Select JSON format (no filter pattern to capture all events).
  - This auto-creates an IAM role for CW Logs to put into Firehose.

Notes:

- Firehose role must have PutObject to your S3 bucket. The wizard handles this; if custom, attach a policy allowing s3:PutObject on `arn:aws:s3:::my-weighingapp-logs-archive/logs/*`.

### 3) Query historical logs with Athena

- Create a Glue database:

```bash
aws glue create-database --database-input Name=weighingapp_logs
```

- Create an external table on the S3 prefix (JSON lines):

```sql
CREATE EXTERNAL TABLE IF NOT EXISTS weighingapp_logs.app_logs (
  `timestamp` string,
  `level` string,
  `message` string,
  `stack` string,
  `service` string,
  `meta` string
)
PARTITIONED BY (year string, month string, day string)
ROW FORMAT SERDE 'org.openx.data.jsonserde.JsonSerDe'
LOCATION 's3://my-weighingapp-logs-archive/logs/'
TBLPROPERTIES ('projection.enabled'='true',
  'projection.year.type'='integer','projection.year.range'='2024,2035',
  'projection.month.type'='integer','projection.month.range'='1,12',
  'projection.day.type'='integer','projection.day.range'='1,31',
  'storage.location.template'='s3://my-weighingapp-logs-archive/logs/${year}/${month}/${day}/');
```

- Query examples (Athena):

```sql
SELECT level, count(*)
FROM weighingapp_logs.app_logs
WHERE year='2025' AND month='8' AND day BETWEEN '15' AND '17'
GROUP BY level;

SELECT *
FROM weighingapp_logs.app_logs
WHERE year='2025' AND month='8'
  AND json_extract_scalar(meta, '$.route') = '/api/entries'
  AND level = 'error'
LIMIT 100;
```

Adjust columns to match your JSON shape (Winston JSON contains fields like level, message, timestamp, stack; you can also query via json_extract_scalar on the raw JSON).

### 4) Metrics and alerts

- Create Log Metric Filters:
  - Example: count “error” level messages
    - Filter pattern: { $.level = "error" }
    - Metric namespace: WeighingApp
    - Metric name: ErrorCount
- Create CloudWatch Alarm on `WeighingApp/ErrorCount` (e.g., > 5 in 5 minutes) → SNS notification.

### 5) Security and IAM

- S3 bucket:
  - Block public access (all four settings).
  - Bucket policy: only allow Firehose principal to PutObject, and optionally your read principals for Athena.
- Encryption:
  - Enable SSE-KMS on S3 (optional) and specify key in Firehose.
  - CloudWatch Logs are encrypted at rest by AWS.
- IAM roles:
  - Firehose role: s3:PutObject, kms:Encrypt if KMS used.
  - CloudWatch Logs role: firehose:PutRecordBatch to the stream.

### 6) Cost controls

- CloudWatch retention: 30–90 days.
- Firehose: GZIP, larger buffers to reduce PUTs.
- S3 lifecycle to IA/Glacier.
- Athena: partition pruning (year/month/day) to reduce scanned data.
- Turn on CloudWatch Logs Insights only when needed.

### 7) Operational notes

- No local log files needed. Remove file transports (done).
- For multi-env (dev/stage/prod):
  - Use separate log groups `/app/weighingapp-dev`, `/app/weighingapp-prod`.
  - Use S3 prefixes per env: logs/prod/… and logs/stage/…
- For PII: avoid logging sensitive data; add a redaction transform in logger if necessary.

### 8) Quick validation checklist

- Logs appear in CW Logs group `/app/weighingapp`.
- Retention shows 90 days.
- S3 bucket receives gzipped objects under `logs/yyyy/mm/dd/`.
- Athena queries return results for last day’s partitions.
- Alarm triggers on error spikes.

If you want, I can:

- Create example Terraform/CloudFormation snippets for the log group, Firehose stream, IAM roles, S3 bucket/lifecycle.
- Add an environment-specific logger field (e.g., service/env) to improve queries.
- Add a small script to validate the whole pipeline end-to-end.
