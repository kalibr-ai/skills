---
name: facebook
description: Guidance for Meta/Facebook Graph API integrations: app setup, auth, webhooks, and operational safety.
---

# Facebook (Meta) Integration Guide

## Goal
Provide a practical baseline for Facebook Graph API integrations: app setup, auth flows, webhooks, and safe operations.

## Use when
- You need to integrate with Facebook APIs (Pages, Webhooks, etc.).
- You need to describe auth and permission scopes.
- You want a security/rate-limit checklist.

## Do not use when
- The request involves policy violations or data misuse.

## Core topics
- App creation and permission scopes.
- OAuth flows and token management.
- Webhook subscription and verification.
- Ops: rate limits, retries, logging.

## Required inputs
- Target API (Pages, Webhooks, etc.).
- App ownership and environment.
- Compliance and data handling constraints.

## Expected output
- A clear integration plan with a technical checklist.

## Notes
- Protect access tokens and app secrets.
- Validate webhook signatures and enforce least privilege.
