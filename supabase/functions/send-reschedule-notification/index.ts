// Send reschedule notification via SMS - notifies patient of date/time change
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface RescheduleNotificationRequest {
  phone: string;
  patientName: string;
  oldDate: string;
  oldTime: string;
  newDate: string;
  newTime: string;
  practiceName: string;
  practicePhone?: string;
  language?: string;
}

// Greek month names (using Unicode escapes)
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
    const dayName = greekDays[date.getDay()];
    return `${dayName}, ${day} ${month}`;
  }
  
  return date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric' 
  });
}

function getRescheduleSmsText(
  practiceName: string, 
  patientName: string,
  oldDate: string, 
  oldTime: string, 
  newDate: string,
  newTime: string,
  language: string, 
  practicePhone?: string
): string {
  const formattedOldDate = formatDateForLanguage(oldDate, language);
  const formattedNewDate = formatDateForLanguage(newDate, language);
  
  if (language === 'el') {
    // Greek: "Αγαπητέ/ή [name], το ραντεβού σας αλλάχθηκε. Νέα ημερομηνία: [date] στις [time]. Για ερωτήσεις καλέστε [phone]."
    let sms = `${practiceName}: \u0391\u03b3\u03b1\u03c0\u03b7\u03c4\u03ad/\u03ae ${patientName}, \u03c4\u03bf \u03c1\u03b1\u03bd\u03c4\u03b5\u03b2\u03bf\u03cd \u03c3\u03b1\u03c2 \u03b1\u03bb\u03bb\u03ac\u03c7\u03b8\u03b7\u03ba\u03b5. \u039d\u03ad\u03b1 \u03b7\u03bc\u03b5\u03c1\u03bf\u03bc\u03b7\u03bd\u03af\u03b1: ${formattedNewDate} \u03c3\u03c4\u03b9\u03c2 ${newTime}.`;
    // "Για ερωτήσεις καλέστε:"
    if (practicePhone) sms += ` \u0393\u03b9\u03b1 \u03b5\u03c1\u03c9\u03c4\u03ae\u03c3\u03b5\u03b9\u03c2 \u03ba\u03b1\u03bb\u03ad\u03c3\u03c4\u03b5: ${practicePhone}`;
    return sms;
  }
  
  let sms = `${practiceName}: Dear ${patientName}, your appointment has been rescheduled. New date: ${formattedNewDate} at ${newTime}.`;
  if (practicePhone) sms += ` Questions? Call: ${practicePhone}`;
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
  console.log("send-reschedule-notification function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      phone,
      patientName,
      oldDate,
      oldTime,
      newDate,
      newTime,
      practiceName,
      practicePhone,
      language = 'en',
    }: RescheduleNotificationRequest = await req.json();

    // Input validation
    if (!phone || !patientName || !newDate || !newTime || !practiceName) {
      console.error("Missing required fields:", { phone, patientName, newDate, newTime, practiceName });
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Dispatching reschedule SMS");

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

    // Format phone and build SMS text
    const formattedPhone = formatPhoneNumber(phone);
    const smsText = getRescheduleSmsText(
      practiceName, 
      patientName,
      oldDate || '', 
      oldTime || '',
      newDate, 
      newTime, 
      language,
      practicePhone
    );
    
    console.log(`Sending SMS to ${formattedPhone}: ${smsText}`);
    
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
    console.log("SMS sent, response:", JSON.stringify(smsResponse));
    
    if (!smsApiResponse.ok) {
      console.error("SMS sending failed:", smsResponse);
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
    console.error("Error in send-reschedule-notification function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
