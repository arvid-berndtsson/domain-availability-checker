export interface Env {
  DISCORD_WEBHOOK_URL: string;
}

const DOMAIN_LIST = ['example.com', 'example.net', 'example.org']; // Add your domains here

// Check domain availability using Google RDAP
async function checkDomainAvailability(domain: string, env: Env): Promise<{ success: boolean; available?: boolean; error?: string }> {
  const url = `https://dns.google/resolve?name=${domain}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return {
        success: false,
        error: `Error: ${response.statusText} (${response.status})`
      };
    }

    const data = await response.json() as { Status: number, Answer?: any[] };

    // Status 3 = NXDOMAIN (domain doesn't exist = available)
    // No Status + Has Answer = domain exists = not available
    const available = data.Status === 3;

    return {
      success: true,
      available
    };
  } catch (error) {
    return {
      success: false,
      error: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      available: false
    };
  }
}

// Send a message to Discord via webhook
async function sendDiscordMessage(message: string, env: Env): Promise<void> {
	await fetch(env.DISCORD_WEBHOOK_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ content: message }),
	});
}

// Main handler function
export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const webhookUrl = env.DISCORD_WEBHOOK_URL;

		const results: Record<string, { available: boolean; error?: string }> = {};
		let hasErrors = false;

		for (const domain of DOMAIN_LIST) {
			const result = await checkDomainAvailability(domain, env);
			if (!result.success) {
				hasErrors = true;
				results[domain] = { available: false, error: result.error };
			} else {
				results[domain] = { available: result.available ?? false };
			}
		}

		if (Object.keys(results).length > 0) {
			const availableDomains = Object.entries(results)
				.filter(([_, data]) => data.available)
				.map(([domain]) => domain);

			if (availableDomains.length > 0) {
				const message = `The following domains are available: ${availableDomains.join(', ')}`;
				await sendDiscordMessage(message, env);
			}
		}

		return new Response(
			JSON.stringify(
				{
					status: hasErrors ? 'error' : 'success',
					results,
					message: 'Domain check completed',
				},
				null,
				2
			),
			{
				status: hasErrors ? 500 : 200,
				headers: {
					'Content-Type': 'application/json',
				},
			}
		);
	},
};
