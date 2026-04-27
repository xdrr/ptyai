# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.0   | Yes       |

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Report vulnerabilities by emailing **0xdrfff@gmail.com** with:

- A description of the vulnerability and its potential impact
- Steps to reproduce or a proof-of-concept
- Any suggested mitigations if you have them

You should receive an acknowledgement within 48 hours. If you do not hear back, follow up to ensure the report was received.

Once the issue is confirmed, a fix will be prepared and a new release published before any public disclosure. Credit will be given to reporters who wish to be acknowledged.

## Scope

ptyai runs shell processes on behalf of an AI agent and by design has broad system access. Issues in scope include:

- Session isolation bypasses (one session accessing another session's PTY)
- Privilege escalation via the MCP interface
- Unintended code execution outside of an established session
- Vulnerabilities in the installer that modify system-level config files
