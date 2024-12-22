export interface Env {
  DISCORD_WEBHOOK_URL: string;
  DOMAINS: string; // Comma-separated list of domains
}

// Define response type for better type safety
type DNSResponse = {
  Status: number;
  Answer?: Array<{ name: string; type: number; TTL: number; data: string }>;
};

// DNS Status enum for better readability and type safety
enum DNSStatus {
  NOERROR = 0,    // Domain exists
  FORMERR = 1,    // Format error
  SERVFAIL = 2,   // Server failed
  NXDOMAIN = 3,   // Domain doesn't exist (available)
  NOTIMP = 4,     // Not implemented
  REFUSED = 5     // Query refused
}

// Parse domains from environment variable
function getDomainList(env: Env): string[] {
  if (!env.DOMAINS) {
    throw new Error("DOMAINS environment variable is not set");
  }
  return env.DOMAINS.split(",")
    .map(domain => domain.trim().toLowerCase())
    .filter(domain => domain.length > 0);
}

async function checkDomainAvailability(domain: string, env: Env): Promise<{ success: boolean; available?: boolean; error?: string }> {
  if (!domain || typeof domain !== "string") {
    return {
      success: false,
      error: "Invalid domain name",
      available: false
    };
  }

  const sanitizedDomain = domain.toLowerCase().trim();
  const url = new URL("https://dns.google/resolve");
  url.searchParams.set("name", sanitizedDomain);

  try {
    const response = await fetch(url, {
      headers: {
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      return {
        success: false,
        error: `DNS lookup failed: ${response.statusText} (${response.status})`,
        available: false
      };
    }

    const data = await response.json() as DNSResponse;

    if (data.Status === DNSStatus.SERVFAIL) {
      return {
        success: false,
        error: "DNS server failed to respond",
        available: false
      };
    }

    if (data.Status === DNSStatus.FORMERR) {
      return {
        success: false,
        error: "DNS query format error",
        available: false
      };
    }

    return {
      success: true,
      available: data.Status === DNSStatus.NXDOMAIN
    };

  } catch (error) {
    return {
      success: false,
      error: `DNS lookup error: ${error instanceof Error ? error.message : "Unknown error"}`,
      available: false
    };
  }
}

// Send a message to Discord via webhook
async function sendDiscordMessage(message: string, env: Env): Promise<void> {
  await fetch(env.DISCORD_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: message }),
  });
}

// Main handler function
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const domains = getDomainList(env);
      const results: Record<string, { available: boolean; error?: string }> = {};
      let hasErrors = false;

      for (const domain of domains) {
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
          const message = `The following domains are available: ${availableDomains.join(", ")}`;
          await sendDiscordMessage(message, env);
        }
      }

      return new Response(
        JSON.stringify(
          {
            status: hasErrors ? "error" : "success",
            results,
            message: "Domain check completed",
          },
          null,
          2
        ),
        {
          status: hasErrors ? 500 : 200,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error"
        }, null, 2),
        {
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
  },
};
