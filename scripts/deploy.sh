#!/bin/bash
#
# Deploy Herald to AWS
#
# Usage:
#   ./scripts/deploy.sh [environment]
#
# Environments: dev (default), staging, prod
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENVIRONMENT="${1:-dev}"
REGION="${AWS_REGION:-us-east-1}"
STACK_NAME="herald-${ENVIRONMENT}"

echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              Herald - Backend Deployment                    ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Environment: ${YELLOW}${ENVIRONMENT}${NC}"
echo -e "Stack Name:  ${YELLOW}${STACK_NAME}${NC}"
echo -e "Region:      ${YELLOW}${REGION}${NC}"
echo ""

cd "$PROJECT_DIR"

# =============================================================================
# Check prerequisites
# =============================================================================
echo -e "${BLUE}Checking prerequisites...${NC}"

if ! command -v sam &> /dev/null; then
    echo -e "${RED}Error: AWS SAM CLI not found${NC}"
    echo "Install with: brew install aws-sam-cli"
    exit 1
fi

if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker not found${NC}"
    exit 1
fi

if ! docker info &> /dev/null; then
    echo -e "${RED}Error: Docker daemon not running${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites OK${NC}"
echo ""

# =============================================================================
# Build
# =============================================================================
echo -e "${BLUE}Building SAM application...${NC}"
sam build --use-container
echo -e "${GREEN}✓ Build complete${NC}"
echo ""

# =============================================================================
# Deploy
# =============================================================================
echo -e "${BLUE}Deploying to AWS...${NC}"

if [ "$ENVIRONMENT" = "prod" ]; then
    sam deploy --config-env prod --no-fail-on-empty-changeset
else
    sam deploy --no-fail-on-empty-changeset
fi

echo -e "${GREEN}✓ Deployment complete${NC}"
echo ""

# =============================================================================
# Run migrations
# =============================================================================
echo -e "${BLUE}Running database migrations...${NC}"

MIGRATION_FUNCTION="${STACK_NAME}-MigrationFunction"

# Check if function exists
if aws lambda get-function --function-name "$MIGRATION_FUNCTION" --region "$REGION" &> /dev/null; then
    aws lambda invoke \
        --function-name "$MIGRATION_FUNCTION" \
        --region "$REGION" \
        --payload '{}' \
        --cli-binary-format raw-in-base64-out \
        /tmp/migration-output.json

    echo "Migration output:"
    cat /tmp/migration-output.json
    echo ""
    echo -e "${GREEN}✓ Migrations complete${NC}"
else
    echo -e "${YELLOW}Migration function not found, skipping...${NC}"
fi
echo ""

# =============================================================================
# Get outputs
# =============================================================================
echo -e "${BLUE}Fetching stack outputs...${NC}"

get_stack_output() {
    local output_key=$1
    aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --query "Stacks[0].Outputs[?OutputKey=='${output_key}'].OutputValue" \
        --output text \
        --region "$REGION" 2>/dev/null || echo ""
}

API_URL=$(get_stack_output "ApiEndpoint")
MCP_URL=$(get_stack_output "McpServerUrl")
ADMIN_UI_URL=$(get_stack_output "AdminUIUrl")
OAUTH_METADATA=$(get_stack_output "OAuthMetadataUrl")

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    Deployment Complete!                     ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}API Endpoint:${NC}"
echo "  ${API_URL}"
echo ""
echo -e "${YELLOW}MCP Server URL (for Claude Desktop):${NC}"
echo "  ${MCP_URL}"
echo ""
echo -e "${YELLOW}OAuth Metadata:${NC}"
echo "  ${OAUTH_METADATA}"
echo ""
echo -e "${YELLOW}Admin UI URL:${NC}"
echo "  ${ADMIN_UI_URL}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Deploy admin-ui: cd admin-ui && ./scripts/deploy.sh ${ENVIRONMENT}"
echo "  2. Create first tenant via platform admin API"
echo "  3. Configure MCP client with the MCP Server URL above"
echo ""
