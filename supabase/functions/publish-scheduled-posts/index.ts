// Supabase Edge Function: Publish Scheduled Posts
// Triggered by pg_cron every minute to check for due posts

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ScheduledPost {
  id: string;
  user_id: string;
  platform: string;
  content: string;
  scheduled_time: string;
  status: string;
}

interface UserSecret {
  secret_data: {
    access_token: string;
    refresh_token?: string;
    expires_at?: string;
  };
}

interface TokenData {
  access_token: string;
  refresh_token?: string;
  expires_at: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role (bypasses RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all due posts (scheduled_time <= now, status = 'scheduled')
    const now = new Date().toISOString();
    const { data: duePosts, error: fetchError } = await supabase
      .from("scheduled_posts")
      .select("*")
      .eq("status", "scheduled")
      .lte("scheduled_time", now);

    if (fetchError) {
      throw new Error(`Failed to fetch due posts: ${fetchError.message}`);
    }

    if (!duePosts || duePosts.length === 0) {
      return new Response(
        JSON.stringify({ message: "No posts due", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${duePosts.length} posts to publish`);

    const results = [];

    for (const post of duePosts as ScheduledPost[]) {
      try {
        // Get user's OAuth token for the platform
        const { data: secretData, error: secretError } = await supabase
          .from("user_secrets")
          .select("secret_data")
          .eq("user_id", post.user_id)
          .eq("secret_type", post.platform)
          .single();

        if (secretError || !secretData) {
          throw new Error(`No ${post.platform} token found for user`);
        }

        const secret = secretData as UserSecret;
        let accessToken = secret.secret_data.access_token;

        // Check if token expired and refresh if needed
        if (post.platform === "twitter" && secret.secret_data.expires_at) {
          const expiresAt = new Date(secret.secret_data.expires_at);
          if (expiresAt < new Date() && secret.secret_data.refresh_token) {
            console.log(`Refreshing expired Twitter token for user ${post.user_id}`);
            const newTokens = await refreshTwitterToken(secret.secret_data.refresh_token);
            accessToken = newTokens.access_token;

            // Save refreshed tokens
            await supabase
              .from("user_secrets")
              .update({
                secret_data: newTokens,
                updated_at: new Date().toISOString(),
              })
              .eq("user_id", post.user_id)
              .eq("secret_type", "twitter");
          }
        }

        // Publish to platform
        if (post.platform === "twitter") {
          await postToTwitter(post.content, accessToken);
        } else if (post.platform === "linkedin") {
          await postToLinkedIn(post.content, accessToken);
        } else {
          throw new Error(`Unsupported platform: ${post.platform}`);
        }

        // Update status to posted
        await supabase
          .from("scheduled_posts")
          .update({
            status: "posted",
            posted_at: new Date().toISOString(),
            error_message: null,
          })
          .eq("id", post.id);

        results.push({ id: post.id, status: "posted", platform: post.platform });
        console.log(`Posted ${post.id} to ${post.platform}`);

      } catch (postError) {
        const errorMessage = postError instanceof Error ? postError.message : "Unknown error";
        console.error(`Failed to post ${post.id}: ${errorMessage}`);

        // Update status to failed
        await supabase
          .from("scheduled_posts")
          .update({
            status: "failed",
            error_message: errorMessage,
          })
          .eq("id", post.id);

        results.push({ id: post.id, status: "failed", error: errorMessage });
      }
    }

    return new Response(
      JSON.stringify({ message: "Processing complete", processed: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`Edge function error: ${errorMessage}`);

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function refreshTwitterToken(refreshToken: string): Promise<TokenData> {
  const clientId = Deno.env.get("TWITTER_CLIENT_ID");
  const clientSecret = Deno.env.get("TWITTER_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error("Twitter client credentials not configured");
  }

  const credentials = btoa(`${clientId}:${clientSecret}`);
  const response = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Twitter token refresh failed: ${errorBody}`);
  }

  const data = await response.json();
  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || refreshToken,
    expires_at: expiresAt,
  };
}

async function postToTwitter(content: string, accessToken: string): Promise<{ id: string }> {
  // Truncate to 280 chars
  const text = content.length > 280 ? content.substring(0, 277) + "..." : content;

  const response = await fetch("https://api.twitter.com/2/tweets", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Twitter API error ${response.status}: ${errorBody}`);
  }

  const data = await response.json();
  return { id: data.data?.id };
}

async function postToLinkedIn(content: string, accessToken: string): Promise<{ id: string }> {
  // Get user's LinkedIn member ID via OpenID Connect userinfo endpoint
  // Note: /v2/me requires r_liteprofile scope which is deprecated
  // With OpenID Connect (openid + profile scopes), use /v2/userinfo instead
  const profileResponse = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: {
      "Authorization": `Bearer ${accessToken}`,
    },
  });

  if (!profileResponse.ok) {
    const errorBody = await profileResponse.text();
    throw new Error(`LinkedIn userinfo API error ${profileResponse.status}: ${errorBody}`);
  }

  const profile = await profileResponse.json();
  // The 'sub' claim contains the member ID for OpenID Connect
  const authorUrn = `urn:li:person:${profile.sub}`;

  // Post to LinkedIn
  const postResponse = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author: authorUrn,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: content },
          shareMediaCategory: "NONE",
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
      },
    }),
  });

  if (!postResponse.ok) {
    const errorBody = await postResponse.text();
    throw new Error(`LinkedIn API error ${postResponse.status}: ${errorBody}`);
  }

  const data = await postResponse.json();
  return { id: data.id };
}
