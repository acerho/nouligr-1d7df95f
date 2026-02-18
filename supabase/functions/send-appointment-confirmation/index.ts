// Send appointment confirmation via email and SMS - REQUIRES AUTHENTICATION
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface AppointmentConfirmationRequest {
  email: string;
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
  'Ιανουαρίου', 'Φεβρουαρίου', 'Μαρτίου', 'Απριλίου', 'Μαΐου', 'Ιουνίου',
  'Ιουλίου', 'Αυγούστου', 'Σεπτεμβρίου', 'Οκτωβρίου', 'Νοεμβρίου', 'Δεκεμβρίου'
];

const greekDays = ['Κυριακή', 'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο'];

function formatDateForLanguage(dateStr: string, language: string): string {
  // Parse the date string (expected format: "January 28, 2026" or similar)
  const date = new Date(dateStr);
  
  if (isNaN(date.getTime())) {
    // If parsing fails, return original string
    return dateStr;
  }
  
  if (language === 'el') {
    const day = date.getDate();
    const month = greekMonths[date.getMonth()];
    const year = date.getFullYear();
    const dayName = greekDays[date.getDay()];
    return `${dayName}, ${day} ${month} ${year}`;
  }
  
  // English format
  return date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

function getConfirmationSmsText(practiceName: string, date: string, time: string, language: string, reason?: string): string {
  const formattedDate = formatDateForLanguage(date, language);
  
  if (language === 'el') {
    const reasonText = reason ? ` Λόγος: ${reason}.` : '';
    return `${practiceName}: Το ραντεβού σας επιβεβαιώθηκε για ${formattedDate} στις ${time}.${reasonText} Παρακαλούμε ελάτε 10 λεπτά νωρίτερα.`;
  }
  const reasonText = reason ? ` Reason: ${reason}.` : '';
  return `${practiceName}: Your appointment is confirmed for ${formattedDate} at ${time}.${reasonText} Please arrive 10 min early.`;
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
  console.log("send-appointment-confirmation function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // AUTHENTICATION CHECK - Only authenticated staff can send confirmations
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error("Missing or invalid authorization header");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create client with user's token to verify authentication
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: authError } = await supabaseAuth.auth.getClaims(token);
    
    if (authError || !claims?.claims) {
      console.error("Authentication failed:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Authenticated user:", claims.claims.sub);

    // Use service role for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      email,
      phone,
      patientName,
      appointmentDate,
      appointmentTime,
      practiceName,
      practiceAddress,
      practicePhone,
      reasonForVisit,
      language = 'en',
    }: AppointmentConfirmationRequest = await req.json();

    // Input validation
    if (!email || !patientName || !appointmentDate || !appointmentTime || !practiceName) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Sending confirmation to ${email} and ${phone} for ${patientName}`);

    const credentials = getInfobipCredentials();

    if (!credentials) {
      console.error("Infobip credentials not configured");
      return new Response(
        JSON.stringify({ error: "Email/SMS service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { apiKey, baseUrl } = credentials;

    // Fetch sender email from practice settings
    const { data: practiceData } = await supabase
      .from('practice_settings')
      .select('infobip_sender_email')
      .limit(1)
      .single();
    
    const senderEmail = practiceData?.infobip_sender_email || 'noreply@infobip.com';
    console.log("Using Infobip base URL:", baseUrl, "Sender:", senderEmail);

    // Build HTML email content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Appointment Confirmation</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 40px 20px;">
              <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <tr>
                  <td style="background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); padding: 32px 40px; text-align: center;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                      ✓ Appointment Confirmed
                    </h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px;">
                    <p style="margin: 0 0 24px; color: #374151; font-size: 16px; line-height: 1.6;">
                      Dear <strong>${patientName}</strong>,
                    </p>
                    <p style="margin: 0 0 24px; color: #374151; font-size: 16px; line-height: 1.6;">
                      Your appointment has been successfully booked. Please find the details below:
                    </p>
                    <table role="presentation" style="width: 100%; background-color: #f0f9ff; border-radius: 8px; border-left: 4px solid #0ea5e9; margin-bottom: 24px;">
                      <tr>
                        <td style="padding: 24px;">
                          <table role="presentation" style="width: 100%;">
                            <tr>
                              <td style="padding-bottom: 16px;">
                                <span style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Date</span>
                                <p style="margin: 4px 0 0; color: #1f2937; font-size: 18px; font-weight: 600;">${appointmentDate}</p>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding-bottom: 16px;">
                                <span style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Time</span>
                                <p style="margin: 4px 0 0; color: #1f2937; font-size: 18px; font-weight: 600;">${appointmentTime}</p>
                              </td>
                            </tr>
                            ${reasonForVisit ? `
                            <tr>
                              <td>
                                <span style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Reason for Visit</span>
                                <p style="margin: 4px 0 0; color: #1f2937; font-size: 16px;">${reasonForVisit}</p>
                              </td>
                            </tr>
                            ` : ''}
                          </table>
                        </td>
                      </tr>
                    </table>
                    <table role="presentation" style="width: 100%; background-color: #f9fafb; border-radius: 8px; margin-bottom: 24px;">
                      <tr>
                        <td style="padding: 20px;">
                          <p style="margin: 0 0 8px; color: #1f2937; font-size: 16px; font-weight: 600;">${practiceName}</p>
                          ${practiceAddress ? `<p style="margin: 0 0 4px; color: #6b7280; font-size: 14px;">📍 ${practiceAddress}</p>` : ''}
                          ${practicePhone ? `<p style="margin: 0; color: #6b7280; font-size: 14px;">📞 ${practicePhone}</p>` : ''}
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 0 0 16px; color: #374151; font-size: 14px; line-height: 1.6;">
                      <strong>Important reminders:</strong>
                    </p>
                    <ul style="margin: 0 0 24px; padding-left: 20px; color: #374151; font-size: 14px; line-height: 1.8;">
                      <li>Please arrive 10 minutes before your scheduled time</li>
                      <li>Bring any relevant medical documents or test results</li>
                      <li>If you need to cancel or reschedule, please contact us as soon as possible</li>
                    </ul>
                    <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                      We look forward to seeing you!
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="background-color: #f9fafb; padding: 24px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                      This is an automated confirmation email. Please do not reply directly to this message.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    // Send Email Confirmation via Infobip
    console.log(`Sending email via Infobip to ${email}`);
    
    const formData = new FormData();
    formData.append('from', `${practiceName} <${senderEmail}>`);
    formData.append('to', email);
    formData.append('subject', `Appointment Confirmation - ${appointmentDate} at ${appointmentTime}`);
    formData.append('html', htmlContent);

    const emailApiResponse = await fetch(`${baseUrl}/email/3/send`, {
      method: "POST",
      headers: {
        "Authorization": `App ${apiKey}`,
      },
      body: formData,
    });

    const emailResponse = await emailApiResponse.json();
    console.log("Infobip email response:", emailResponse);

    if (!emailApiResponse.ok) {
      console.error("Email sending failed:", emailResponse);
    }

    // Send SMS Confirmation via Infobip
    let smsResponse = null;
    if (phone) {
      const formattedPhone = formatPhoneNumber(phone);
      const smsText = getConfirmationSmsText(practiceName, appointmentDate, appointmentTime, language, reasonForVisit);
      console.log(`Using language for SMS: ${language}`);
      
      console.log(`Sending SMS to ${formattedPhone}`);
      
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
      
      smsResponse = await smsApiResponse.json();
      console.log("SMS sent, response:", smsResponse);
      
      if (!smsApiResponse.ok) {
        console.error("SMS sending failed:", smsResponse);
      }
    }

    return new Response(JSON.stringify({ success: true, emailResponse, smsResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-appointment-confirmation function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
