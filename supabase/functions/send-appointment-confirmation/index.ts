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
}

function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (!cleaned.startsWith('30')) {
    cleaned = '30' + cleaned;
  }
  return cleaned;
}

async function getInfobipCredentials(supabase: any): Promise<{ apiKey: string; baseUrl: string } | null> {
  // First try to get from database (practice_settings)
  const { data: settings } = await supabase
    .from("practice_settings")
    .select("infobip_api_key, infobip_base_url")
    .limit(1)
    .maybeSingle();

  if (settings?.infobip_api_key && settings?.infobip_base_url) {
    let baseUrl = settings.infobip_base_url;
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      baseUrl = `https://${baseUrl}`;
    }
    baseUrl = baseUrl.replace(/\/$/, '');
    return { apiKey: settings.infobip_api_key, baseUrl };
  }

  // Fallback to environment variables
  const INFOBIP_API_KEY = Deno.env.get("INFOBIP_API_KEY");
  let INFOBIP_BASE_URL = Deno.env.get("INFOBIP_BASE_URL");

  if (INFOBIP_API_KEY && INFOBIP_BASE_URL) {
    if (!INFOBIP_BASE_URL.startsWith('http://') && !INFOBIP_BASE_URL.startsWith('https://')) {
      INFOBIP_BASE_URL = `https://${INFOBIP_BASE_URL}`;
    }
    INFOBIP_BASE_URL = INFOBIP_BASE_URL.replace(/\/$/, '');
    return { apiKey: INFOBIP_API_KEY, baseUrl: INFOBIP_BASE_URL };
  }

  return null;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-appointment-confirmation function called");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
    }: AppointmentConfirmationRequest = await req.json();

    console.log(`Sending confirmation to ${email} and ${phone} for ${patientName}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get Infobip credentials from database or environment
    const credentials = await getInfobipCredentials(supabase);

    if (!credentials) {
      console.error("Infobip credentials not configured");
      return new Response(
        JSON.stringify({ error: "Email/SMS service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { apiKey, baseUrl } = credentials;
    console.log("Using Infobip base URL:", baseUrl);

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
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); padding: 32px 40px; text-align: center;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                      ✓ Appointment Confirmed
                    </h1>
                  </td>
                </tr>
                
                <!-- Body -->
                <tr>
                  <td style="padding: 40px;">
                    <p style="margin: 0 0 24px; color: #374151; font-size: 16px; line-height: 1.6;">
                      Dear <strong>${patientName}</strong>,
                    </p>
                    <p style="margin: 0 0 24px; color: #374151; font-size: 16px; line-height: 1.6;">
                      Your appointment has been successfully booked. Please find the details below:
                    </p>
                    
                    <!-- Appointment Details Card -->
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
                    
                    <!-- Practice Info -->
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
                
                <!-- Footer -->
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
    
    const emailPayload = {
      messages: [
        {
          destinations: [{ to: email }],
          from: `${practiceName} <noreply@infobip.com>`,
          subject: `Appointment Confirmation - ${appointmentDate} at ${appointmentTime}`,
          html: htmlContent,
        },
      ],
    };

    const emailApiResponse = await fetch(`${baseUrl}/email/3/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `App ${apiKey}`,
      },
      body: JSON.stringify(emailPayload),
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
      const smsText = `${practiceName}: Your appointment is confirmed for ${appointmentDate} at ${appointmentTime}.${reasonForVisit ? ` Reason: ${reasonForVisit}.` : ''} Please arrive 10 min early.`;
      
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