"""
Tests for PKCE (Proof Key for Code Exchange) utilities.
Tests compliance with RFC 7636.
"""

import pytest
import base64
import hashlib
from app.utils.pkce import generate_code_verifier, generate_code_challenge


class TestPKCE:
    """Test PKCE implementation."""

    def test_generate_code_verifier_length(self):
        """Test that code verifier has correct length (43-128 chars)."""
        verifier = generate_code_verifier()

        # RFC 7636 Section 4.1: verifier must be 43-128 characters
        assert 43 <= len(verifier) <= 128, f"Verifier length {len(verifier)} out of range"

    def test_generate_code_verifier_characters(self):
        """Test that code verifier uses only allowed characters."""
        verifier = generate_code_verifier()

        # RFC 7636 Section 4.1: [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"
        allowed_chars = set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~")
        verifier_chars = set(verifier)

        assert verifier_chars.issubset(allowed_chars), "Verifier contains invalid characters"

    def test_generate_code_verifier_uniqueness(self):
        """Test that code verifier is random (generates unique values)."""
        verifiers = {generate_code_verifier() for _ in range(100)}

        # All 100 verifiers should be unique
        assert len(verifiers) == 100, "Code verifier is not sufficiently random"

    def test_generate_code_challenge_format(self):
        """Test that code challenge is properly base64url encoded."""
        verifier = "test_verifier_12345678901234567890123456789012"
        challenge = generate_code_challenge(verifier)

        # Challenge should be base64url (no +, /, or =)
        assert "+" not in challenge, "Challenge contains '+' (should be base64url)"
        assert "/" not in challenge, "Challenge contains '/' (should be base64url)"
        assert "=" not in challenge, "Challenge contains padding (should be stripped)"

        # Should only contain base64url characters
        allowed_chars = set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_")
        assert set(challenge).issubset(allowed_chars), "Challenge contains invalid base64url characters"

    def test_generate_code_challenge_sha256(self):
        """Test that code challenge correctly uses SHA256."""
        verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"

        # RFC 7636 Appendix B example
        expected_challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"

        challenge = generate_code_challenge(verifier)
        assert challenge == expected_challenge, "Challenge does not match RFC 7636 example"

    def test_generate_code_challenge_deterministic(self):
        """Test that same verifier produces same challenge."""
        verifier = "test_verifier_abc123"

        challenge1 = generate_code_challenge(verifier)
        challenge2 = generate_code_challenge(verifier)

        assert challenge1 == challenge2, "Challenge should be deterministic"

    def test_generate_code_challenge_length(self):
        """Test that code challenge has expected length (SHA256 hash)."""
        verifier = generate_code_verifier()
        challenge = generate_code_challenge(verifier)

        # SHA256 produces 32 bytes = 256 bits
        # Base64 encoded (without padding) = 43 characters
        assert len(challenge) == 43, f"Challenge length {len(challenge)} != 43"

    def test_code_challenge_verification(self):
        """Test that challenge can be verified from verifier."""
        verifier = generate_code_verifier()
        challenge = generate_code_challenge(verifier)

        # Manually compute challenge to verify
        digest = hashlib.sha256(verifier.encode('ascii')).digest()
        expected_challenge = base64.urlsafe_b64encode(digest).decode('ascii').rstrip('=')

        assert challenge == expected_challenge, "Challenge verification failed"
