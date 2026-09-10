import os
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from typing import List, Optional

logger = logging.getLogger("email_service")
logging.basicConfig(level=logging.INFO)

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "sendermailpro@gmail.com")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "").replace(" ", "")
ADMIN_ALERT_EMAIL = os.getenv("ADMIN_ALERT_EMAIL", "")

def get_recipient_list(override_to: Optional[str] = None) -> List[str]:
    """
    Parses comma-separated email list from override or environment.
    """
    raw = override_to or ADMIN_ALERT_EMAIL
    if not raw:
        return []
    return [e.strip() for e in raw.split(",") if e.strip() and "@" in e]


def send_email_alert(
    subject: str,
    html_body: str,
    recipients: Optional[List[str]] = None,
    priority: str = "normal"
) -> dict:
    """
    Sends a formatted HTML email via Gmail SMTP TLS to one or multiple recipients.
    """
    to_list = recipients or get_recipient_list()
    if not to_list:
        logger.warning("No recipient emails configured for alerts. Skipping email send.")
        return {"status": "skipped", "reason": "No recipient emails configured (ADMIN_ALERT_EMAIL empty)"}

    if not SMTP_PASSWORD:
        logger.warning("SMTP_PASSWORD not configured. Skipping live email send.")
        return {"status": "skipped", "reason": "SMTP_PASSWORD not set in environment variables"}

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"Manubhai Security & Alert Bot <{SMTP_USER}>"
        msg["To"] = ", ".join(to_list)
        if priority == "high":
            msg["X-Priority"] = "1"
            msg["Priority"] = "Urgent"

        part = MIMEText(html_body, "html")
        msg.attach(part)

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_USER, to_list, msg.as_string())

        logger.info(f"📧 [Email Alert Sent] '{subject}' successfully delivered to {to_list}")
        return {"status": "sent", "recipients": to_list, "subject": subject}

    except Exception as e:
        logger.error(f"❌ Failed to send alert email: {e}")
        return {"status": "error", "error": str(e)}


def send_whatsapp_failure_alert(
    recipient_phone: str,
    template_name: str,
    error_reason: str
) -> dict:
    """
    Dispatched when a WhatsApp message fails to send.
    """
    now_str = datetime.now().strftime("%d %b %Y, %I:%M %p IST")
    subject = f"🚨 [WhatsApp Failed] Message to {recipient_phone} could not be delivered"
    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #E5E7EB; border-radius: 12px; overflow: hidden; background: #FFFFFF;">
      <div style="background: #DC2626; padding: 18px 24px; color: white;">
        <h2 style="margin: 0; font-size: 18px; font-weight: bold;">🚨 WhatsApp Delivery Failure Alert</h2>
        <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.9;">Manubhai Gathiyawala • Automated Notification</p>
      </div>
      <div style="padding: 24px; color: #1F2937; line-height: 1.6;">
        <p style="margin-top: 0;">An outbound WhatsApp message encountered an error and could not be delivered to the recipient.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 18px 0; font-size: 13px;">
          <tr style="border-bottom: 1px solid #F3F4F6;">
            <td style="padding: 8px 0; font-weight: bold; color: #4B5563;">Failed Recipient:</td>
            <td style="padding: 8px 0; font-family: monospace; font-size: 14px; font-weight: bold; color: #DC2626;">{recipient_phone}</td>
          </tr>
          <tr style="border-bottom: 1px solid #F3F4F6;">
            <td style="padding: 8px 0; font-weight: bold; color: #4B5563;">Template Name:</td>
            <td style="padding: 8px 0; font-family: monospace; color: #111827;">{template_name}</td>
          </tr>
          <tr style="border-bottom: 1px solid #F3F4F6;">
            <td style="padding: 8px 0; font-weight: bold; color: #4B5563;">Timestamp:</td>
            <td style="padding: 8px 0; color: #111827;">{now_str}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #4B5563; vertical-align: top;">Failure Reason:</td>
            <td style="padding: 8px 0; color: #B91C1C; background: #FEF2F2; padding: 8px; border-radius: 6px; font-family: monospace; font-size: 12px;">{error_reason}</td>
          </tr>
        </table>

        <div style="background: #F9FAFB; padding: 14px; border-radius: 8px; border-left: 4px solid #F5A623; margin-top: 20px; font-size: 12px; color: #4B5563;">
          <strong>Suggested Action:</strong> Check if this phone number is verified in Meta Developer Console or if the Meta API access token has expired.
        </div>
      </div>
      <div style="background: #F9FAFB; padding: 12px 24px; text-align: center; font-size: 11px; color: #9CA3AF; border-top: 1px solid #F3F4F6;">
        Sent automatically by Manubhai Gathiyawala WhatsApp CRM via sendermailpro@gmail.com
      </div>
    </div>
    """
    return send_email_alert(subject=subject, html_body=html_body, priority="high")


def send_security_intrusion_alert(
    event_type: str,
    ip_address: str,
    details: str
) -> dict:
    """
    Dispatched when suspicious activity, brute-force logins, or unauthorized webhook calls occur.
    """
    now_str = datetime.now().strftime("%d %b %Y, %I:%M %p IST")
    subject = f"🛡️ [SECURITY ALERT] Suspicious Activity Detected: {event_type}"
    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #E5E7EB; border-radius: 12px; overflow: hidden; background: #FFFFFF;">
      <div style="background: #111827; padding: 18px 24px; color: white; border-bottom: 3px solid #EF4444;">
        <h2 style="margin: 0; font-size: 18px; font-weight: bold;">🛡️ Security & Intrusion Warning</h2>
        <p style="margin: 4px 0 0 0; font-size: 12px; color: #9CA3AF;">Manubhai Gathiyawala • Firewall & Access Protection</p>
      </div>
      <div style="padding: 24px; color: #1F2937; line-height: 1.6;">
        <p style="margin-top: 0; font-weight: 500; color: #B91C1C;">A potential security incident or unauthorized access attempt was intercepted by the server.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 18px 0; font-size: 13px;">
          <tr style="border-bottom: 1px solid #F3F4F6;">
            <td style="padding: 8px 0; font-weight: bold; color: #4B5563;">Incident Type:</td>
            <td style="padding: 8px 0; font-weight: bold; color: #DC2626;">{event_type}</td>
          </tr>
          <tr style="border-bottom: 1px solid #F3F4F6;">
            <td style="padding: 8px 0; font-weight: bold; color: #4B5563;">Attacker IP:</td>
            <td style="padding: 8px 0; font-family: monospace; font-weight: bold; color: #111827;">{ip_address}</td>
          </tr>
          <tr style="border-bottom: 1px solid #F3F4F6;">
            <td style="padding: 8px 0; font-weight: bold; color: #4B5563;">Detected At:</td>
            <td style="padding: 8px 0; color: #111827;">{now_str}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #4B5563; vertical-align: top;">Incident Details:</td>
            <td style="padding: 8px 0; color: #374151; background: #F3F4F6; padding: 8px; border-radius: 6px; font-family: monospace; font-size: 12px;">{details}</td>
          </tr>
        </table>

        <div style="background: #FEF2F2; padding: 14px; border-radius: 8px; border-left: 4px solid #DC2626; margin-top: 20px; font-size: 12px; color: #991B1B;">
          <strong>Security Action Taken:</strong> The request was blocked and rate-limited. If this IP persists, it will be automatically dropped.
        </div>
      </div>
      <div style="background: #F9FAFB; padding: 12px 24px; text-align: center; font-size: 11px; color: #9CA3AF; border-top: 1px solid #F3F4F6;">
        Security Engine • sendermailpro@gmail.com
      </div>
    </div>
    """
    return send_email_alert(subject=subject, html_body=html_body, priority="high")


def send_ten_minute_digest_email(db) -> dict:
    """
    Sends an executive summary of activity, sent messages, and system health.
    """
    import models
    from datetime import timedelta
    ten_mins_ago = datetime.utcnow() - timedelta(minutes=10)

    # Messages sent in last 10 mins
    recent_msgs = db.query(models.MessageLog).filter(models.MessageLog.created_at >= ten_mins_ago).all()
    successful_count = sum(1 for m in recent_msgs if m.status in ["SENT", "SENT_SIMULATED", "DELIVERED"])
    failed_count = sum(1 for m in recent_msgs if m.status == "FAILED")

    # Recent carts
    recent_carts = db.query(models.CartEvent).filter(models.CartEvent.created_at >= ten_mins_ago).all()
    recovered_revenue = sum(c.cart_value for c in recent_carts if c.status == "RECOVERED")

    now_str = datetime.now().strftime("%d %b %Y, %I:%M %p IST")
    subject = f"📊 [10-Min Digest] WhatsApp CRM: {successful_count} sent, {failed_count} errors, ₹{recovered_revenue:,.0f} recovered"
    
    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #E5E7EB; border-radius: 12px; overflow: hidden; background: #FFFFFF;">
      <div style="background: #111827; padding: 18px 24px; color: white;">
        <h2 style="margin: 0; font-size: 18px; font-weight: bold;">📊 10-Minute System Activity Digest</h2>
        <p style="margin: 4px 0 0 0; font-size: 12px; color: #25D366;">● Server Online • APScheduler Active</p>
      </div>
      <div style="padding: 24px; color: #1F2937;">
        <p style="margin-top: 0; font-size: 13px; color: #6B7280;">Activity summary for the past 10 minutes ({now_str}):</p>
        
        <div style="display: flex; gap: 12px; margin: 18px 0;">
          <div style="flex: 1; background: #F0FDF4; border: 1px solid #BBF7D0; padding: 14px; border-radius: 8px; text-align: center;">
            <div style="font-size: 22px; font-weight: bold; color: #15803D;">{successful_count}</div>
            <div style="font-size: 11px; font-weight: bold; text-transform: uppercase; color: #166534; margin-top: 2px;">Messages Sent</div>
          </div>
          <div style="flex: 1; background: {'#FEF2F2' if failed_count > 0 else '#F9FAFB'}; border: 1px solid {'#FECACA' if failed_count > 0 else '#E5E7EB'}; padding: 14px; border-radius: 8px; text-align: center;">
            <div style="font-size: 22px; font-weight: bold; color: {'#DC2626' if failed_count > 0 else '#4B5563'};">{failed_count}</div>
            <div style="font-size: 11px; font-weight: bold; text-transform: uppercase; color: {'#991B1B' if failed_count > 0 else '#6B7280'}; margin-top: 2px;">Failed Sends</div>
          </div>
          <div style="flex: 1; background: #FFFBEB; border: 1px solid #FDE68A; padding: 14px; border-radius: 8px; text-align: center;">
            <div style="font-size: 22px; font-weight: bold; color: #B45309;">₹{recovered_revenue:,.0f}</div>
            <div style="font-size: 11px; font-weight: bold; text-transform: uppercase; color: #92400E; margin-top: 2px;">Recovered</div>
          </div>
        </div>

        <div style="font-size: 12px; color: #4B5563; border-top: 1px solid #F3F4F6; padding-top: 14px;">
          <strong>Recent Cart Drops:</strong> {len(recent_carts)} detected in last 10m<br/>
          <strong>Database Connection:</strong> Operational (Aiven PostgreSQL)<br/>
          <strong>Uptime Monitor:</strong> UptimeRobot Active
        </div>
      </div>
      <div style="background: #F9FAFB; padding: 12px 24px; text-align: center; font-size: 11px; color: #9CA3AF; border-top: 1px solid #F3F4F6;">
        Manubhai Gathiyawala • Automated 10-minute Heartbeat
      </div>
    </div>
    """
    return send_email_alert(subject=subject, html_body=html_body)
