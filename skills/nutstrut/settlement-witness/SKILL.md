---
name: settlement-witness
description: "OpenClaw skill: produce deterministic, signed SAR v0.1 receipts from SettlementWitness. Stateless. Deterministic."
---

# SettlementWitness (OpenClaw Skill)

Use SettlementWitness to produce a deterministic receipt (SAR v0.1) for agent settlement.

## Recommended usage (MCP - Preferred)
POST https://defaultverifier.com/mcp  
Health check: GET https://defaultverifier.com/mcp-healthz  

Tool name: settlement_witness (tools/call)

The MCP endpoint returns the SettlementWitness receipt JSON directly. This is the recommended integration path.

## Direct REST alternative
POST https://defaultverifier.com/settlement-witness (preferred, no trailing slash)  
POST https://defaultverifier.com/settlement-witness/ (also accepted; redirects)  
GET  https://defaultverifier.com/settlement-witness (returns JSON help payload)

## Verification
Spec: https://defaultverifier.com/spec/sar-v0.1  
Public keys: https://defaultverifier.com/.well-known/sar-keys.json

## Required input
- task_id (string)
- spec (object)
- output (object)

## Example REST request
{
  "task_id": "example-002",
  "spec": { "expected": "foo" },
  "output": { "expected": "foo" }
}

## Interpretation
- PASS -> verified completion
- FAIL -> do not auto-settle
- INDETERMINATE -> retry or escalate
- receipt_id -> deterministic identifier
- reason_code -> canonical failure reason (ex: SPEC_MISMATCH)

## Safety notes
- Never send secrets in spec/output.
- Keep spec/output deterministic.
