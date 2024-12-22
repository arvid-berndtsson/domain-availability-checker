# Godaddy Domain Checker

## Setup

1. Create a new Cloudflare account and set up a new worker.
2. Set up a Discord webhook and add the webhook URL to the worker.
3. Add the domains you want to check to the `DOMAIN_LIST` variable in the worker.
4. Deploy the worker.

## Environment Variables

- `DISCORD_WEBHOOK_URL`: The URL of the Discord webhook.

Set the variable in the worker's environment variables. Use the `wrangler secret put` command to set the secret.

```bash
wrangler secret put DISCORD_WEBHOOK_URL
```

### Local Environment Variables

Create a `.dev.vars` file in the root of the project and add the following variables:

```bash
DISCORD_WEBHOOK_URL=your_webhook_here
```

## DNS Response Codes
- 0 = NOERROR: Domain exists
- 1 = FORMERR: Format error
- 2 = SERVFAIL: Server failed
- 3 = NXDOMAIN: Domain does not exist (available)
- 4 = NOTIMP: Not implemented
- 5 = REFUSED: Query refused
