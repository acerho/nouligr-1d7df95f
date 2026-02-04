// Send appointment reminder via SMS
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ReminderRequest {
  appointmentId: string;
  language?: string;
}

// Greek month names (using Unicode escapes)
const greekMonths = [
  '\u0399\u03b1\u03bd\u03bf\u03c5\u03b1\u03c1\u03af\u03bf\u03c5',
  '\u03a6\u03b5\u03b2\u03c1\u03bf\u03c5\u03b1\u03c1\u03af\u03bf\u03c5',
  '\u039c\u03b1\u03c1\u03c4\u03af\u03bf\u03c5',
  '\u0391\u03c0\u03c1\u03b9\u03bb\u03af\u03bf\u03c5',
  '\u039c\u03b1\u0390\u03bf\u03c5',
  '\u0399\u03bf\u03c5\u03bd\u03af\u03bf\u03c5',
  '\u0399\u03bf\u03c5\u03bb\u03af\u03bf\u03c5',
  '\u0391\u03c5\u03b3\u03bf\u03cd\u03c3\u03c4\u03bf\u03c5',
  '\u03a3\u03b5\u03c0\u03c4\u03b5\u03bc\u03b2\u03c1\u03af\u03bf\u03c5',
  '\u039f\u03ba\u03c4\u03c9\u03b2\u03c1\u03af\u03bf\u03c5',
  '\u039d\u03bf\u03b5\u03bc\u03b2\u03c1\u03af\u03bf\u03c5',
  '\u0394\u03b5\u03ba\u03b5\u03bc\u03b2\u03c1\u03af\u03bf\u03c5'
];

// Greek day names (using Unicode escapes)
const greekDays = [
  '\u039a\u03c5\u03c1\u03b9\u03b1\u03ba\u03ae',
  '\u0394\u03b5\u03c5\u03c4\u03ad\u03c1\u03b1',
  '\u03a4\u03c1\u03af\u03c4\u03b7',
  '\u03a4\u03b5\u03c4\u03ac\u03c1\u03c4\u03b7',
  '\u03a0\u03ad\u03bc\u03c0\u03c4\u03b7',
  '\u03a0\u03b1\u03c1\u03b1\u03c3\u03ba\u03b5\u03c5\u03ae',
  '\u03a3\u03ac\u03b2\u03b2\u03b1\u03c4\u03bf'
];

function formatDateForLanguage(date: Date, language: string): string {
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

function formatTime(date: Date): string {
  return date.toLocaleTimeString('el-GR', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });
}

function getReminderSmsText(
  practiceName: string,
  patientName: string,
  date: Date,
  language: string,
  reason?: string
): string {
  const formattedDate = formatDateForLanguage(date, language);
  const formattedTime = formatTime(date);
  
  if (language === 'el') {
    // Greek: "Υπενθύμιση: Έχετε ραντεβού στο [practice] την [date] στις [time]. Παρακαλούμε ελάτε 10 λεπτά νωρίτερα."
    let sms = `${practiceName}: \u03a5\u03c0\u03b5\u03bd\u03b8\u03cd\u03bc\u03b9\u03c3\u03b7! \u0391\u03b3\u03b1\u03c0\u03b7\u03c4\u03ad/\u03ae ${patientName}, \u03ad\u03c7\u03b5\u03c4\u03b5 \u03c1\u03b1\u03bd\u03c4\u03b5\u03b2\u03bf\u03cd ${formattedDate} \u03c3\u03c4\u03b9\u03c2 ${formattedTime}.`;
    if (reason) sms += ` \u039b\u03cc\u03b3\u03bf\u03c2: ${reason}.`;
    // "Παρακαλούμε ελάτε 10 λεπτά νωρίτερα."
    sms += ` \u03a0\u03b1\u03c1\u03b1\u03ba\u03b1\u03bb\u03bf\u03cd\u03bc\u03b5 \u03b5\u03bb\u03ac\u03c4\u03b5 10 \u03bb\u03b5\u03c0\u03c4\u03ac \u03bd\u03c9\u03c1\u03af\u03c4\u03b5\u03c1\u03b1.`;
    return sms;
  }
  
  let sms = `${practiceName}: Reminder! Dear ${patientName}, you have an appointment on ${formattedDate} at ${formattedTime}.`;
  if (reason) sms += ` Reason: ${reason}.`;
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
  console.log("send-appointment-reminder function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header for authenticated request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { appointmentId, language = 'el' }: ReminderRequest = await req.json();

    if (!appointmentId) {
      return new Response(
        JSON.stringify({ error: "Missing appointmentId" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Sending reminder for appointment ${appointmentId}`);

    // Fetch appointment with patient info
    const { data: appointment, error: aptError } = await supabase
      .from('appointments')
      .select(`
        *,
        patient:patients(*)
      `)
      .eq('id', appointmentId)
      .single();

    if (aptError || !appointment) {
      console.error("Error fetching appointment:", aptError);
      return new Response(
        JSON.stringify({ error: "Appointment not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const patient = appointment.patient;
    if (!patient?.phone) {
      return new Response(
        JSON.stringify({ error: "Patient has no phone number" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!appointment.scheduled_at) {
      return new Response(
        JSON.stringify({ error: "Appointment has no scheduled date" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fetch practice settings
    const { data: settings } = await supabase
      .from('practice_settings')
      .select('practice_name')
      .single();

    const practiceName = settings?.practice_name || 'Medical Practice';
    const patientName = `${patient.first_name} ${patient.last_name}`;
    const scheduledDate = new Date(appointment.scheduled_at);

    const credentials = getInfobipCredentials();
    if (!credentials) {
      console.error("Infobip credentials not configured");
      return new Response(
        JSON.stringify({ error: "SMS service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { apiKey, baseUrl } = credentials;
    const formattedPhone = formatPhoneNumber(patient.phone);
    const smsText = getReminderSmsText(
      practiceName,
      patientName,
      scheduledDate,
      language,
      appointment.reason_for_visit
    );

    console.log(`Sending reminder SMS to ${formattedPhone}: ${smsText}`);

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
    console.log("SMS response:", JSON.stringify(smsResponse));

    if (!smsApiResponse.ok) {
      console.error("SMS sending failed:", smsResponse);
      return new Response(
        JSON.stringify({ success: false, error: "SMS sending failed", details: smsResponse }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Log the notification
    await supabase.from('notification_logs').insert({
      patient_id: appointment.patient_id,
      appointment_id: appointmentId,
      message: `Appointment reminder sent via SMS`,
      notification_type: 'reminder',
    });

    return new Response(JSON.stringify({ success: true, smsResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    console.error("Error in send-appointment-reminder function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
