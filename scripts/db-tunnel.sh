#!/bin/bash
# Opens a tunnel to Aurora via SSM Session Manager
# Usage: ./scripts/db-tunnel.sh [environment] [local_port]
# Example: ./scripts/db-tunnel.sh prod 5432

set -e

ENV="${1:-prod}"
LOCAL_PORT="${2:-5432}"

echo "Fetching connection details for herald-${ENV}..."

# Find an online SSM-enabled instance (Maven shared bastion)
BASTION_ID=$(aws ssm describe-instance-information \
  --query "InstanceInformationList[?PingStatus=='Online'].InstanceId | [0]" \
  --output text 2>/dev/null)

if [ -z "$BASTION_ID" ] || [ "$BASTION_ID" = "None" ]; then
  echo "Error: Could not find an online SSM-enabled instance"
  echo "Make sure the Maven bastion host is running."
  exit 1
fi

# Get the Aurora cluster endpoint
AURORA_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name "herald-${ENV}" \
  --query "Stacks[0].Outputs[?OutputKey=='AuroraClusterEndpoint'].OutputValue" \
  --output text 2>/dev/null)

if [ -z "$AURORA_ENDPOINT" ] || [ "$AURORA_ENDPOINT" = "None" ]; then
  echo "Error: Could not find Aurora cluster endpoint for herald-${ENV}"
  exit 1
fi

# Get the database password from Secrets Manager
SECRET_ARN=$(aws cloudformation describe-stacks \
  --stack-name "herald-${ENV}" \
  --query "Stacks[0].Outputs[?OutputKey=='AuroraSecretArn'].OutputValue" \
  --output text 2>/dev/null)

DB_PASSWORD=$(aws secretsmanager get-secret-value \
  --secret-id "$SECRET_ARN" \
  --query SecretString \
  --output text 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)['password'])")

echo ""
echo "Opening SSM tunnel to Aurora..."
echo "  Bastion: $BASTION_ID"
echo "  Aurora: $AURORA_ENDPOINT"
echo "  Local port: $LOCAL_PORT"
echo ""
echo "Connect your GUI tool to:"
echo "  Host: localhost"
echo "  Port: $LOCAL_PORT"
echo "  Database: herald"
echo "  Username: herald_admin"
echo "  Password: $DB_PASSWORD"
echo ""
echo "Press Ctrl+C to close the tunnel"
echo ""

aws ssm start-session \
  --target "$BASTION_ID" \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters "{\"host\":[\"$AURORA_ENDPOINT\"],\"portNumber\":[\"5432\"],\"localPortNumber\":[\"$LOCAL_PORT\"]}"
