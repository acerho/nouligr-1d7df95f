// Send booking confirmation via SMS - PUBLIC endpoint for patient bookings
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

// Greek month names
const greekMonths = [
  'Ianouariou', 'Fevrouariou', 'Martiou', 'Apriliou', 'Maiou', 'Iouniou',
  'Iouliou', 'Avgoustou', 'Septemvriou', 'Oktovriou', 'Noemvriou', 'Dekemvriou'
];

const greekDays = ['Kyriaki', 'Deftera', 'Triti', 'Tetarti', 'Pempti', 'Paraskevi', 'Savvato'];

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
    let sms = `${practiceName}: Agapite/i ${patientName}, to rantevou sas epivevaioothike gia ${formattedDate} stis ${time}.`;
    if (reason) sms += ` Logos: ${reason}.`;
    if (address) sms += ` Diefthinsi: ${address}.`;
    if (practicePhone) sms += ` Til: ${practicePhone}.`;
    sms += ` Parakalume elate 10 lepta noristera.`;
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

    console.log(`Sending booking confirmation SMS to ${phone} for ${patientName}`);

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
    console.error("Error in send-booking-confirmation function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
