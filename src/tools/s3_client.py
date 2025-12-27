"""S3 client utilities for Herald tools."""

import boto3
from botocore.exceptions import ClientError
from typing import Optional
from utils.secrets import get_bucket_credentials


def get_s3_client_for_bucket(bucket_config: dict):
    """
    Get S3 client with appropriate credentials.

    For cross-account buckets, assumes the IAM role specified in credentials_secret_arn.
    For same-account buckets, uses Lambda's execution role.
    """
    credentials_arn = bucket_config.get("credentials_secret_arn")
    region = bucket_config.get("bucket_region", "us-east-1")

    if not credentials_arn:
        # Same account - use Lambda's execution role
        return boto3.client("s3", region_name=region)

    # Cross-account - assume role from Secrets Manager
    credentials = get_bucket_credentials(credentials_arn)
    role_arn = credentials.get("role_arn")

    if not role_arn:
        raise ValueError(f"No role_arn in credentials secret: {credentials_arn}")

    # Assume the role
    sts = boto3.client("sts")
    bucket_id = bucket_config.get("id", "unknown")[:8]

    assumed = sts.assume_role(
        RoleArn=role_arn,
        RoleSessionName=f"herald-{bucket_id}",
        DurationSeconds=3600
    )

    creds = assumed["Credentials"]
    return boto3.client(
        "s3",
        region_name=region,
        aws_access_key_id=creds["AccessKeyId"],
        aws_secret_access_key=creds["SecretAccessKey"],
        aws_session_token=creds["SessionToken"]
    )


def test_bucket_connection(bucket_config: dict) -> tuple[bool, str]:
    """
    Test connection to an S3 bucket.

    Returns:
        Tuple of (success, message)
    """
    try:
        s3 = get_s3_client_for_bucket(bucket_config)
        bucket_name = bucket_config["bucket_name"]
        prefix = bucket_config.get("prefix", "")

        # Try to list objects with the prefix (limited to 1)
        s3.list_objects_v2(
            Bucket=bucket_name,
            Prefix=prefix,
            MaxKeys=1
        )

        return True, "Connection successful"
    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code", "Unknown")
        error_msg = e.response.get("Error", {}).get("Message", str(e))
        return False, f"{error_code}: {error_msg}"
    except Exception as e:
        return False, str(e)
