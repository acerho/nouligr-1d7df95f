<?php
/**
 * Generic SMS Sender (staff only)
 * Replaces edge functions: send-appointment-confirmation, send-booking-confirmation, 
 * send-appointment-reminder, send-reschedule-notification
 *
 * POST /api/send-sms.php?action=confirmation       - Appointment confirmation (email + SMS)
 * POST /api/send-sms.php?action=booking             - Booking SMS confirmation
 * POST /api/send-sms.php?action=reminder            - Appointment reminder SMS
 * POST /api/send-sms.php?action=reschedule          - Reschedule notification SMS
 */
require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method not allowed'], 405);
}

$action = $_GET['action'] ?? '';
$data = getJsonInput();

switch ($action) {
    case 'confirmation':
        requireStaff();
        sendAppointmentConfirmation($data);
        break;
    case 'booking':
        sendBookingConfirmation($data);
        break;
    case 'reminder':
        requireStaff();
        sendReminder($data);
        break;
    case 'reschedule':
        sendRescheduleNotification($data);
        break;
    default:
        jsonResponse(['error' => 'Invalid action'], 400);
}

function formatPhone(string $phone): string {
    $cleaned = preg_replace('/\D/', '', $phone);
    if (!str_starts_with($cleaned, '30')) $cleaned = '30' . $cleaned;
    return $cleaned;
}

function sendInfobipSms(string $to, string $text): array {
    $payload = json_encode([
        'messages' => [[
            'destinations' => [['to' => $to]],
            'from' => 'Appointment',
            'text' => $text,
        ]],
    ]);

    $ch = curl_init(INFOBIP_BASE_URL . '/sms/2/text/advanced');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Authorization: App ' . INFOBIP_API_KEY,
        ],
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return ['status' => $httpCode, 'response' => json_decode($response, true)];
}

function sendInfobipEmail(string $to, string $subject, string $html): array {
    $pdo = getDB();
    $stmt = $pdo->query("SELECT practice_name, infobip_sender_email FROM practice_settings LIMIT 1");
    $settings = $stmt->fetch();
    $senderEmail = $settings['infobip_sender_email'] ?? INFOBIP_SENDER_EMAIL;
    $practiceName = $settings['practice_name'] ?? 'Medical Practice';

    $boundary = uniqid('boundary');
    $body = "--$boundary\r\n"
        . "Content-Disposition: form-data; name=\"from\"\r\n\r\n$practiceName <$senderEmail>\r\n"
        . "--$boundary\r\n"
        . "Content-Disposition: form-data; name=\"to\"\r\n\r\n$to\r\n"
        . "--$boundary\r\n"
        . "Content-Disposition: form-data; name=\"subject\"\r\n\r\n$subject\r\n"
        . "--$boundary\r\n"
        . "Content-Disposition: form-data; name=\"html\"\r\n\r\n$html\r\n"
        . "--$boundary--\r\n";

    $ch = curl_init(INFOBIP_BASE_URL . '/email/3/send');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $body,
        CURLOPT_HTTPHEADER => [
            "Content-Type: multipart/form-data; boundary=$boundary",
            'Authorization: App ' . INFOBIP_API_KEY,
        ],
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return ['status' => $httpCode, 'response' => json_decode($response, true)];
}

function sendAppointmentConfirmation(array $data): void {
    $email = $data['email'] ?? '';
    $phone = $data['phone'] ?? '';
    $patientName = $data['patientName'] ?? '';
    $date = $data['appointmentDate'] ?? '';
    $time = $data['appointmentTime'] ?? '';
    $practiceName = $data['practiceName'] ?? '';
    $language = $data['language'] ?? 'el';

    if (!$email || !$patientName || !$date || !$time || !$practiceName) {
        jsonResponse(['error' => 'Missing required fields'], 400);
    }

    // Send email
    $html = buildConfirmationEmailHtml($patientName, $date, $time, $practiceName, $data['practiceAddress'] ?? '', $data['practicePhone'] ?? '', $data['reasonForVisit'] ?? '');
    $emailResult = sendInfobipEmail($email, "Appointment Confirmation - $date at $time", $html);

    // Send SMS
    $smsResult = null;
    if ($phone) {
        $smsText = "$practiceName: Αγαπητέ/ή $patientName, το ραντεβού σας επιβεβαιώθηκε για $date στις $time. Παρακαλούμε ελάτε 10 λεπτά νωρίτερα.";
        if ($language !== 'el') {
            $smsText = "$practiceName: Dear $patientName, your appointment is confirmed for $date at $time. Please arrive 10 min early.";
        }
        $smsResult = sendInfobipSms(formatPhone($phone), $smsText);
    }

    jsonResponse(['success' => true, 'emailResponse' => $emailResult, 'smsResponse' => $smsResult]);
}

function sendBookingConfirmation(array $data): void {
    $phone = $data['phone'] ?? '';
    $patientName = $data['patientName'] ?? '';
    $date = $data['appointmentDate'] ?? '';
    $time = $data['appointmentTime'] ?? '';
    $practiceName = $data['practiceName'] ?? '';
    $language = $data['language'] ?? 'el';

    if (!$phone || !$patientName || !$date || !$time || !$practiceName) {
        jsonResponse(['error' => 'Missing required fields'], 400);
    }

    $smsText = "$practiceName: Αγαπητέ/ή $patientName, το ραντεβού σας επιβεβαιώθηκε για $date στις $time. Παρακαλούμε ελάτε 10 λεπτά νωρίτερα.";
    if ($language !== 'el') {
        $smsText = "$practiceName: Dear $patientName, your appointment is confirmed for $date at $time. Please arrive 10 min early.";
    }

    $result = sendInfobipSms(formatPhone($phone), $smsText);
    jsonResponse(['success' => $result['status'] < 400, 'smsResponse' => $result]);
}

function sendReminder(array $data): void {
    $appointmentId = $data['appointmentId'] ?? '';
    $language = $data['language'] ?? 'el';

    if (!$appointmentId) jsonResponse(['error' => 'Missing appointmentId'], 400);

    $pdo = getDB();
    $stmt = $pdo->prepare('SELECT a.*, p.first_name, p.last_name, p.phone FROM appointments a JOIN patients p ON a.patient_id = p.id WHERE a.id = ?');
    $stmt->execute([$appointmentId]);
    $apt = $stmt->fetch();

    if (!$apt) jsonResponse(['error' => 'Appointment not found'], 404);
    if (!$apt['phone']) jsonResponse(['error' => 'Patient has no phone number'], 400);

    $stmt = $pdo->query('SELECT practice_name FROM practice_settings LIMIT 1');
    $practiceName = $stmt->fetchColumn() ?: 'Medical Practice';

    $name = $apt['first_name'] . ' ' . $apt['last_name'];
    $dateObj = new DateTime($apt['scheduled_at']);
    $dateStr = $dateObj->format('d/m/Y');
    $timeStr = $dateObj->format('H:i');

    $smsText = "$practiceName: Υπενθύμιση! Αγαπητέ/ή $name, έχετε ραντεβού $dateStr στις $timeStr. Παρακαλούμε ελάτε 10 λεπτά νωρίτερα.";
    if ($language !== 'el') {
        $smsText = "$practiceName: Reminder! Dear $name, you have an appointment on $dateStr at $timeStr. Please arrive 10 min early.";
    }

    $result = sendInfobipSms(formatPhone($apt['phone']), $smsText);

    // Log notification
    $pdo->prepare('INSERT INTO notification_logs (id, patient_id, appointment_id, message, notification_type, sent_at) VALUES (?, ?, ?, ?, ?, NOW())')
        ->execute([generateUUID(), $apt['patient_id'], $appointmentId, 'Appointment reminder sent via SMS', 'reminder']);

    jsonResponse(['success' => $result['status'] < 400, 'smsResponse' => $result]);
}

function sendRescheduleNotification(array $data): void {
    $phone = $data['phone'] ?? '';
    $patientName = $data['patientName'] ?? '';
    $newDate = $data['newDate'] ?? '';
    $newTime = $data['newTime'] ?? '';
    $practiceName = $data['practiceName'] ?? '';
    $language = $data['language'] ?? 'el';

    if (!$phone || !$patientName || !$newDate || !$newTime || !$practiceName) {
        jsonResponse(['error' => 'Missing required fields'], 400);
    }

    $smsText = "$practiceName: Αγαπητέ/ή $patientName, το ραντεβού σας αλλάχθηκε. Νέα ημερομηνία: $newDate στις $newTime.";
    if ($language !== 'el') {
        $smsText = "$practiceName: Dear $patientName, your appointment has been rescheduled. New date: $newDate at $newTime.";
    }
    if (!empty($data['practicePhone'])) {
        $smsText .= ($language === 'el') ? " Τηλ: {$data['practicePhone']}" : " Tel: {$data['practicePhone']}";
    }

    $result = sendInfobipSms(formatPhone($phone), $smsText);
    jsonResponse(['success' => $result['status'] < 400, 'smsResponse' => $result]);
}

function buildConfirmationEmailHtml(string $name, string $date, string $time, string $practice, string $address, string $phone, string $reason): string {
    $reasonHtml = $reason ? "<tr><td><span style=\"color:#6b7280;font-size:12px;text-transform:uppercase\">Reason for Visit</span><p style=\"margin:4px 0 0;color:#1f2937;font-size:16px\">$reason</p></td></tr>" : '';
    $addressHtml = $address ? "<p style=\"margin:0 0 4px;color:#6b7280;font-size:14px\">📍 $address</p>" : '';
    $phoneHtml = $phone ? "<p style=\"margin:0;color:#6b7280;font-size:14px\">📞 $phone</p>" : '';

    return <<<HTML
<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background-color:#f5f5f5">
<table style="width:100%;border-collapse:collapse"><tr><td style="padding:40px 20px">
<table style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,.1)">
<tr><td style="background:linear-gradient(135deg,#0ea5e9,#0284c7);padding:32px 40px;text-align:center">
<h1 style="margin:0;color:#fff;font-size:24px">✓ Appointment Confirmed</h1></td></tr>
<tr><td style="padding:40px">
<p style="margin:0 0 24px;color:#374151;font-size:16px">Dear <strong>$name</strong>,</p>
<p style="margin:0 0 24px;color:#374151;font-size:16px">Your appointment has been successfully booked.</p>
<table style="width:100%;background:#f0f9ff;border-radius:8px;border-left:4px solid #0ea5e9;margin-bottom:24px">
<tr><td style="padding:24px"><table style="width:100%">
<tr><td style="padding-bottom:16px"><span style="color:#6b7280;font-size:12px;text-transform:uppercase">Date</span>
<p style="margin:4px 0 0;color:#1f2937;font-size:18px;font-weight:600">$date</p></td></tr>
<tr><td style="padding-bottom:16px"><span style="color:#6b7280;font-size:12px;text-transform:uppercase">Time</span>
<p style="margin:4px 0 0;color:#1f2937;font-size:18px;font-weight:600">$time</p></td></tr>
$reasonHtml
</table></td></tr></table>
<table style="width:100%;background:#f9fafb;border-radius:8px;margin-bottom:24px">
<tr><td style="padding:20px"><p style="margin:0 0 8px;color:#1f2937;font-size:16px;font-weight:600">$practice</p>
$addressHtml $phoneHtml</td></tr></table>
<ul style="margin:0 0 24px;padding-left:20px;color:#374151;font-size:14px;line-height:1.8">
<li>Please arrive 10 minutes before your scheduled time</li>
<li>Bring any relevant medical documents</li>
<li>Contact us to cancel or reschedule</li></ul>
</td></tr>
<tr><td style="background:#f9fafb;padding:24px 40px;text-align:center;border-top:1px solid #e5e7eb">
<p style="margin:0;color:#9ca3af;font-size:12px">Automated confirmation - do not reply</p></td></tr>
</table></td></tr></table></body></html>
HTML;
}
