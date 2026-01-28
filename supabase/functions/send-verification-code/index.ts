import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerificationRequest {
  phone: string;
  patientName: string;
}

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  
  // If doesn't start with country code, assume it needs one
  // You may need to adjust this based on your region
  if (!cleaned.startsWith('1') && cleaned.length === 10) {
    cleaned = '1' + cleaned; // Add US country code
  }
  
  return cleaned;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, patientName }: VerificationRequest = await req.json();

    if (!phone) {
      return new Response(
        JSON.stringify({ error: "Phone number is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const formattedPhone = formatPhoneNumber(phone);
    console.log("Sending SMS to:", formattedPhone);

    // Generate 6-digit verification code
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    // Store verification code in database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Use phone as the identifier in the email_verifications table
    // (we're reusing the table, storing phone in the email column)
    const { error: dbError } = await supabase
      .from("email_verifications")
      .insert({
        email: formattedPhone, // Using email column to store phone
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

    // Send SMS with verification code using Infobip
    const INFOBIP_API_KEY = Deno.env.get("INFOBIP_API_KEY");
    const INFOBIP_BASE_URL = Deno.env.get("INFOBIP_BASE_URL");
    
    console.log("INFOBIP_API_KEY exists:", !!INFOBIP_API_KEY);
    console.log("INFOBIP_BASE_URL exists:", !!INFOBIP_BASE_URL);
    
    if (!INFOBIP_API_KEY || !INFOBIP_BASE_URL) {
      console.error("Infobip credentials not configured");
      return new Response(
        JSON.stringify({ error: "SMS service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const smsPayload = {
      messages: [
        {
          destinations: [{ to: formattedPhone }],
          from: "Appointment",
          text: `Hello ${patientName}, your appointment verification code is: ${code}. This code expires in 10 minutes.`,
        },
      ],
    };

    console.log("Sending SMS via Infobip...");
    
    const smsResponse = await fetch(`${INFOBIP_BASE_URL}/sms/2/text/advanced`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `App ${INFOBIP_API_KEY}`,
      },
      body: JSON.stringify(smsPayload),
    });

    const responseText = await smsResponse.text();
    console.log("Infobip response status:", smsResponse.status);
    console.log("Infobip response:", responseText);

    if (!smsResponse.ok) {
      console.error("Infobip error:", responseText);
      return new Response(
        JSON.stringify({ error: "Failed to send SMS. Please try again." }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("SMS sent successfully");

    return new Response(
      JSON.stringify({ success: true, message: "Verification code sent via SMS" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
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
