"""
PKCE (Proof Key for Code Exchange) utilities for OAuth 2.0
Implements RFC 7636 specification
"""

import secrets
import hashlib
import base64


def generate_code_verifier() -> str:
    """
    Generate a cryptographically secure code verifier.

    RFC 7636 Section 4.1:
    - Length: 43-128 characters
    - Characters: [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"

    Returns:
        str: A random code verifier (64 characters)
    """
    # secrets.token_urlsafe(48) generates 64 base64url characters
    # (48 bytes * 4/3 = 64 chars)
    return secrets.token_urlsafe(48)


def generate_code_challenge(verifier: str) -> str:
    """
    Generate a code challenge from a code verifier using SHA256.

    RFC 7636 Section 4.2:
    - code_challenge = BASE64URL(SHA256(ASCII(code_verifier)))

    Args:
        verifier: The code verifier to hash

    Returns:
        str: Base64URL-encoded SHA256 hash (no padding)
    """
    # Hash the verifier with SHA256
    digest = hashlib.sha256(verifier.encode('ascii')).digest()

    # Base64URL encode (RFC 4648 Section 5)
    # - Replace + with -, / with _
    # - Remove padding (=)
    challenge = base64.urlsafe_b64encode(digest).decode('ascii')
    return challenge.rstrip('=')
