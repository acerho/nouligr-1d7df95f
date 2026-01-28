// Verify code with rate limiting and brute force protection
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyRequest {
  phone: string;
  code: string;
}

const RATE_LIMIT_MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 900000; // 15 minutes

function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (!cleaned.startsWith('30')) {
    cleaned = '30' + cleaned;
  }
  return cleaned;
}

async function checkRateLimit(supabase: any, identifier: string, actionType: string): Promise<{ allowed: boolean; remaining: number }> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  
  const { data: attempts, error } = await supabase
    .from("rate_limit_log")
    .select("id")
    .eq("identifier", identifier)
    .eq("action_type", actionType)
    .gte("created_at", windowStart);

  if (error) {
    console.error("Rate limit check error:", error);
    return { allowed: true, remaining: RATE_LIMIT_MAX_ATTEMPTS };
  }

  const count = attempts?.length || 0;
  const remaining = Math.max(0, RATE_LIMIT_MAX_ATTEMPTS - count);
  
  return { allowed: count < RATE_LIMIT_MAX_ATTEMPTS, remaining };
}

async function logRateLimitAttempt(supabase: any, identifier: string, actionType: string): Promise<void> {
  const { error } = await supabase
    .from("rate_limit_log")
    .insert({
      identifier,
      action_type: actionType,
    });

  if (error) {
    console.error("Failed to log rate limit attempt:", error);
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, code }: VerifyRequest = await req.json();

    if (!phone || !code) {
      return new Response(
        JSON.stringify({ error: "Phone number and code are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate code format (8 digits)
    const codeRegex = /^[0-9]{6,8}$/;
    if (!codeRegex.test(code)) {
      return new Response(
        JSON.stringify({ error: "Invalid code format" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const formattedPhone = formatPhoneNumber(phone);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Rate limiting check for verification attempts
    const { allowed, remaining } = await checkRateLimit(supabase, formattedPhone, "verify_code");
    
    if (!allowed) {
      console.log(`Rate limit exceeded for verification attempts: ${formattedPhone}`);
      return new Response(
        JSON.stringify({ error: "Too many verification attempts. Please request a new code." }),
        { 
          status: 429, 
          headers: { 
            "Content-Type": "application/json", 
            "X-RateLimit-Remaining": "0",
            "Retry-After": "900",
            ...corsHeaders 
          } 
        }
      );
    }

    // Log the verification attempt BEFORE checking the code
    await logRateLimitAttempt(supabase, formattedPhone, "verify_code");

    // Find the verification record
    const { data: verification, error: fetchError } = await supabase
      .from("email_verifications")
      .select("*")
      .eq("email", formattedPhone)
      .eq("code", code)
      .is("verified_at", null)
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      console.error("Database error:", fetchError);
      return new Response(
        JSON.stringify({ error: "Verification failed" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!verification) {
      // Don't reveal whether the code was wrong or expired
      return new Response(
        JSON.stringify({ error: "Invalid or expired verification code" }),
        { 
          status: 400, 
          headers: { 
            "Content-Type": "application/json",
            "X-RateLimit-Remaining": String(remaining - 1),
            ...corsHeaders 
          } 
        }
      );
    }

    // Mark as verified
    await supabase
      .from("email_verifications")
      .update({ verified_at: new Date().toISOString() })
      .eq("id", verification.id);

    return new Response(
      JSON.stringify({ success: true, verified: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in verify-code function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
