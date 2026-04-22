// Send verification code via SMS with multi-language support and rate limiting
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerificationRequest {
  phone: string;
  patientName: string;
  language?: string;
}

const RATE_LIMIT_MAX_REQUESTS = 20;
const RATE_LIMIT_WINDOW_MS = 3600000; // 1 hour

function getVerificationSmsText(name: string, code: string, language: string): string {
  if (language === 'el') {
    return `Γειά σας ${name}, ο κωδικός επαλήθευσης του ραντεβού σας είναι: ${code}. Αυτός ο κωδικός λήγει σε 10 λεπτά.`;
  }
  return `Hello ${name}, your appointment verification code is: ${code}. This code expires in 10 minutes.`;
}

function generateCode(): string {
  // Generate 4-digit code
  return Math.floor(1000 + Math.random() * 9000).toString();
}

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
    // Allow on error to avoid blocking legitimate users
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS };
  }

  const count = attempts?.length || 0;
  const remaining = Math.max(0, RATE_LIMIT_MAX_REQUESTS - count);
  
  return { allowed: count < RATE_LIMIT_MAX_REQUESTS, remaining };
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

function getInfobipCredentials(): { apiKey: string; baseUrl: string } | null {
  const INFOBIP_API_KEY = Deno.env.get("INFOBIP_API_KEY");
  let INFOBIP_BASE_URL = Deno.env.get("INFOBIP_BASE_URL");

  if (INFOBIP_API_KEY && INFOBIP_BASE_URL) {
    if (!INFOBIP_BASE_URL.startsWith('http://') && !INFOBIP_BASE_URL.startsWith('https://')) {
      INFOBIP_BASE_URL = `https://${INFOBIP_BASE_URL}`;
    }
    INFOBIP_BASE_URL = INFOBIP_BASE_URL.replace(/\/$/, '');
    console.log("Using Infobip credentials from environment secrets");
    return { apiKey: INFOBIP_API_KEY, baseUrl: INFOBIP_BASE_URL };
  }

  return null;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, patientName, language = 'en' }: VerificationRequest = await req.json();

    if (!phone) {
      return new Response(
        JSON.stringify({ error: "Phone number is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate phone format (basic validation)
    const phoneRegex = /^[0-9+\-\s()]{7,20}$/;
    if (!phoneRegex.test(phone)) {
      return new Response(
        JSON.stringify({ error: "Invalid phone number format" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const formattedPhone = formatPhoneNumber(phone);
    console.log("Processing verification code request");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Rate limiting check
    const { allowed, remaining } = await checkRateLimit(supabase, formattedPhone, "send_verification");
    
    if (!allowed) {
      console.log("Rate limit exceeded for verification request");
      return new Response(
        JSON.stringify({ error: "Too many verification attempts. Please try again later." }),
        { 
          status: 429, 
          headers: { 
            "Content-Type": "application/json", 
            "X-RateLimit-Remaining": "0",
            "Retry-After": "3600",
            ...corsHeaders 
          } 
        }
      );
    }

    // Log the attempt
    await logRateLimitAttempt(supabase, formattedPhone, "send_verification");

    // Generate 8-digit verification code
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const { error: dbError } = await supabase
      .from("email_verifications")
      .insert({
        email: formattedPhone,
        code,
        expires_at: expiresAt.toISOString(),
      });

    if (dbError) {
      console.error("Database error:", dbError);
      return new Response(
        JSON.stringify({ error: "Failed to create verification" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const credentials = getInfobipCredentials();
    
    if (!credentials) {
      console.error("Infobip credentials not configured");
      return new Response(
        JSON.stringify({ error: "SMS service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { apiKey, baseUrl } = credentials;
    console.log("Using Infobip base URL:", baseUrl);

    const messageText = getVerificationSmsText(patientName, code, language);
    console.log(`Using language: ${language}`);

    const smsPayload = {
      messages: [
        {
          destinations: [{ to: formattedPhone }],
          from: "Appointment",
          text: messageText,
        },
      ],
    };

    console.log("Sending SMS via Infobip to URL:", `${baseUrl}/sms/2/text/advanced`);
    
    const smsResponse = await fetch(`${baseUrl}/sms/2/text/advanced`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `App ${apiKey}`,
      },
      body: JSON.stringify(smsPayload),
    });

    const responseText = await smsResponse.text();
    console.log("Infobip response status:", smsResponse.status);

    if (!smsResponse.ok) {
      console.error("Infobip error:", responseText);
      return new Response(
        JSON.stringify({ error: "Failed to send SMS. Please try again." }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("SMS sent successfully");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Verification code sent via SMS",
        rateLimitRemaining: remaining - 1
      }),
      { 
        status: 200, 
        headers: { 
          "Content-Type": "application/json",
          "X-RateLimit-Remaining": String(remaining - 1),
          ...corsHeaders 
        } 
      }
    );
  } catch (error: any) {
    console.error("Error in send-verification-code function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
