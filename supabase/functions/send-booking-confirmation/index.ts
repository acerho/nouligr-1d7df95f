// Send booking confirmation via SMS - PUBLIC endpoint for patient bookings
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RATE_LIMIT_MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 3600000; // 1 hour

async function checkRateLimit(supabase: any, identifier: string, actionType: string): Promise<{ allowed: boolean; remaining: number }> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { data: attempts, error } = await supabase
    .from("rate_limit_log")
    .select("id")
    .eq("identifier", identifier)
    .eq("action_type", actionType)
    .gte("created_at", windowStart);
  if (error) return { allowed: true, remaining: RATE_LIMIT_MAX_ATTEMPTS };
  const count = attempts?.length || 0;
  return { allowed: count < RATE_LIMIT_MAX_ATTEMPTS, remaining: Math.max(0, RATE_LIMIT_MAX_ATTEMPTS - count) };
}

async function logRateLimitAttempt(supabase: any, identifier: string, actionType: string): Promise<void> {
  await supabase.from("rate_limit_log").insert({ identifier, action_type: actionType });
}

interface BookingConfirmationRequest {
  phone: string;
  patientName: string;
  appointmentDate: string;
  appointmentTime: string;
  practiceName: string;
  practiceAddress?: string;
  practicePhone?: string;
  reasonForVisit?: string;
  language?: string;
}

// Greek month names in Greek (using Unicode escapes to prevent encoding issues)
const greekMonths = [
  '\u0399\u03b1\u03bd\u03bf\u03c5\u03b1\u03c1\u03af\u03bf\u03c5',    // Ιανουαρίου
  '\u03a6\u03b5\u03b2\u03c1\u03bf\u03c5\u03b1\u03c1\u03af\u03bf\u03c5', // Φεβρουαρίου
  '\u039c\u03b1\u03c1\u03c4\u03af\u03bf\u03c5',                      // Μαρτίου
  '\u0391\u03c0\u03c1\u03b9\u03bb\u03af\u03bf\u03c5',                // Απριλίου
  '\u039c\u03b1\u0390\u03bf\u03c5',                                  // Μαΐου
  '\u0399\u03bf\u03c5\u03bd\u03af\u03bf\u03c5',                      // Ιουνίου
  '\u0399\u03bf\u03c5\u03bb\u03af\u03bf\u03c5',                      // Ιουλίου
  '\u0391\u03c5\u03b3\u03bf\u03cd\u03c3\u03c4\u03bf\u03c5',          // Αυγούστου
  '\u03a3\u03b5\u03c0\u03c4\u03b5\u03bc\u03b2\u03c1\u03af\u03bf\u03c5', // Σεπτεμβρίου
  '\u039f\u03ba\u03c4\u03c9\u03b2\u03c1\u03af\u03bf\u03c5',          // Οκτωβρίου
  '\u039d\u03bf\u03b5\u03bc\u03b2\u03c1\u03af\u03bf\u03c5',          // Νοεμβρίου
  '\u0394\u03b5\u03ba\u03b5\u03bc\u03b2\u03c1\u03af\u03bf\u03c5'     // Δεκεμβρίου
];

// Greek day names (using Unicode escapes)
const greekDays = [
  '\u039a\u03c5\u03c1\u03b9\u03b1\u03ba\u03ae',   // Κυριακή
  '\u0394\u03b5\u03c5\u03c4\u03ad\u03c1\u03b1',   // Δευτέρα
  '\u03a4\u03c1\u03af\u03c4\u03b7',               // Τρίτη
  '\u03a4\u03b5\u03c4\u03ac\u03c1\u03c4\u03b7',   // Τετάρτη
  '\u03a0\u03ad\u03bc\u03c0\u03c4\u03b7',         // Πέμπτη
  '\u03a0\u03b1\u03c1\u03b1\u03c3\u03ba\u03b5\u03c5\u03ae', // Παρασκευή
  '\u03a3\u03ac\u03b2\u03b2\u03b1\u03c4\u03bf'    // Σάββατο
];

function formatDateForLanguage(dateStr: string, language: string): string {
  const date = new Date(dateStr);
  
  if (isNaN(date.getTime())) {
    return dateStr;
  }
  
  if (language === 'el') {
    const day = date.getDate();
    const month = greekMonths[date.getMonth()];
    const year = date.getFullYear();
    const dayName = greekDays[date.getDay()];
    return `${dayName}, ${day} ${month} ${year}`;
  }
  
  return date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

function getConfirmationSmsText(
  practiceName: string, 
  patientName: string,
  date: string, 
  time: string, 
  language: string, 
  address?: string,
  practicePhone?: string,
  reason?: string
): string {
  const formattedDate = formatDateForLanguage(date, language);
  
  if (language === 'el') {
    // Greek SMS text using Unicode escapes
    // "Αγαπητέ/ή [name], το ραντεβού σας επιβεβαιώθηκε για [date] στις [time]."
    let sms = `${practiceName}: \u0391\u03b3\u03b1\u03c0\u03b7\u03c4\u03ad/\u03ae ${patientName}, \u03c4\u03bf \u03c1\u03b1\u03bd\u03c4\u03b5\u03b2\u03bf\u03cd \u03c3\u03b1\u03c2 \u03b5\u03c0\u03b9\u03b2\u03b5\u03b2\u03b1\u03b9\u03ce\u03b8\u03b7\u03ba\u03b5 \u03b3\u03b9\u03b1 ${formattedDate} \u03c3\u03c4\u03b9\u03c2 ${time}.`;
    // "Λόγος:"
    if (reason) sms += ` \u039b\u03cc\u03b3\u03bf\u03c2: ${reason}.`;
    // "Διεύθυνση:"
    if (address) sms += ` \u0394\u03b9\u03b5\u03cd\u03b8\u03c5\u03bd\u03c3\u03b7: ${address}.`;
    // "Τηλ:"
    if (practicePhone) sms += ` \u03a4\u03b7\u03bb: ${practicePhone}.`;
    // "Παρακαλούμε ελάτε 10 λεπτά νωρίτερα."
    sms += ` \u03a0\u03b1\u03c1\u03b1\u03ba\u03b1\u03bb\u03bf\u03cd\u03bc\u03b5 \u03b5\u03bb\u03ac\u03c4\u03b5 10 \u03bb\u03b5\u03c0\u03c4\u03ac \u03bd\u03c9\u03c1\u03af\u03c4\u03b5\u03c1\u03b1.`;
    return sms;
  }
  
  let sms = `${practiceName}: Dear ${patientName}, your appointment is confirmed for ${formattedDate} at ${time}.`;
  if (reason) sms += ` Reason: ${reason}.`;
  if (address) sms += ` Address: ${address}.`;
  if (practicePhone) sms += ` Tel: ${practicePhone}.`;
  sms += ` Please arrive 10 min early.`;
  return sms;
}

function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (!cleaned.startsWith('30')) {
    cleaned = '30' + cleaned;
  }
  return cleaned;
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
  console.log("send-booking-confirmation function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      phone,
      patientName,
      appointmentDate,
      appointmentTime,
      practiceName,
      practiceAddress,
      practicePhone,
      reasonForVisit,
      language = 'en',
    }: BookingConfirmationRequest = await req.json();

    // Input validation
    if (!phone || !patientName || !appointmentDate || !appointmentTime || !practiceName) {
      console.error("Missing required fields:", { phone, patientName, appointmentDate, appointmentTime, practiceName });
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Rate limiting: at most 5 booking confirmations per phone per hour
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const formattedPhoneEarly = formatPhoneNumber(phone);
    const { allowed } = await checkRateLimit(supabase, formattedPhoneEarly, "send_booking_confirmation");
    if (!allowed) {
      console.log("Rate limit exceeded for booking confirmation");
      return new Response(
        JSON.stringify({ error: "Too many requests. Please try again later." }),
        { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "3600", ...corsHeaders } }
      );
    }
    await logRateLimitAttempt(supabase, formattedPhoneEarly, "send_booking_confirmation");

    console.log("Dispatching booking confirmation SMS");

    const credentials = getInfobipCredentials();

    if (!credentials) {
      console.error("Infobip credentials not configured");
      return new Response(
        JSON.stringify({ error: "SMS service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { apiKey, baseUrl } = credentials;

    // Format phone and build SMS text
    const formattedPhone = formatPhoneNumber(phone);
    const smsText = getConfirmationSmsText(
      practiceName, 
      patientName,
      appointmentDate, 
      appointmentTime, 
      language,
      practiceAddress,
      practicePhone,
      reasonForVisit
    );
    
    console.log("Sending SMS via Infobip");
    
    const smsApiResponse = await fetch(`${baseUrl}/sms/2/text/advanced`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `App ${apiKey}`,
      },
      body: JSON.stringify({
        messages: [
          {
            destinations: [{ to: formattedPhone }],
            from: "Appointment",
            text: smsText,
          },
        ],
      }),
    });
    
    const smsResponse = await smsApiResponse.json();
    console.log("SMS API responded with status:", smsApiResponse.status);

    if (!smsApiResponse.ok) {
      console.error("SMS sending failed with status:", smsApiResponse.status);
      return new Response(
        JSON.stringify({ success: false, error: "SMS sending failed", details: smsResponse }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(JSON.stringify({ success: true, smsResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    console.error("Error in send-booking-confirmation function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
