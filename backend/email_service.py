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
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "").replace(" ", "")
ADMIN_ALERT_EMAIL = os.getenv("ADMIN_ALERT_EMAIL", "")
ENABLE_SMTP = os.getenv("ENABLE_SMTP", "false").lower() in ("true", "1", "yes")
DASHBOARD_URL = os.getenv("DASHBOARD_URL", "https://bazikscalifts.vercel.app").rstrip("/")

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
    Bypasses connection if ENABLE_SMTP is false (default) to avoid Render port blockage.
    """
    if not ENABLE_SMTP:
        logger.debug(f"📧 [Email Alert Bypassed] SMTP is disabled. Alert: {subject}")
        return {"status": "disabled", "reason": "SMTP email delivery is disabled"}

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


def send_2fa_recovery_email(recipient_email: str, username: str, recovery_code: str) -> dict:
    """
    Sends an urgent 6-digit emergency 2FA recovery code for admin login.
    """
    now_str = datetime.now().strftime("%d %b %Y, %I:%M %p IST")
    subject = f"🔐 [2FA Emergency Code] {recovery_code} is your Manubhai CRM login code"
    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; border: 1px solid #E5E7EB; border-radius: 12px; overflow: hidden; background: #FFFFFF;">
      <div style="background: #111827; padding: 20px 24px; color: white; border-bottom: 3px solid #25D366;">
        <h2 style="margin: 0; font-size: 18px; font-weight: bold;">🔐 Two-Factor Authentication (2FA)</h2>
        <p style="margin: 4px 0 0 0; font-size: 12px; color: #9CA3AF;">Emergency Sign-In Verification Code</p>
      </div>
      <div style="padding: 24px; color: #1F2937; line-height: 1.6;">
        <p style="margin-top: 0; font-size: 14px;">Hello <strong>{username}</strong>,</p>
        <p style="font-size: 13px; color: #4B5563;">You requested an emergency email recovery code to complete your two-factor login to the Manubhai Gathiyawala WhatsApp CRM.</p>
        
        <div style="text-align: center; margin: 24px 0;">
          <div style="display: inline-block; background: #F3F4F6; border: 2px dashed #25D366; padding: 14px 28px; border-radius: 12px;">
            <span style="font-family: monospace; font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #111827;">{recovery_code}</span>
          </div>
          <p style="font-size: 11px; color: #6B7280; margin-top: 8px;">Valid for <strong>10 minutes</strong>. Single use only.</p>
        </div>

        <div style="background: #FFFBEB; padding: 12px 16px; border-radius: 8px; border-left: 4px solid #F5A623; font-size: 12px; color: #92400E;">
          <strong>Security Notice:</strong> If you did not initiate this login attempt, someone may know your password. Change your password immediately or alert the system administrator.
        </div>
      </div>
      <div style="background: #F9FAFB; padding: 12px 24px; text-align: center; font-size: 11px; color: #9CA3AF; border-top: 1px solid #F3F4F6;">
        Manubhai Gathiyawala WhatsApp CRM • Security Layer
      </div>
    </div>
    """
    return send_email_alert(subject=subject, html_body=html_body, recipients=[recipient_email], priority="high")


def send_automation_approval_email(
    rule_name: str,
    rule_id: int,
    recipient_count: int,
    template_name: str,
    condition: str
) -> dict:
    """
    Alerts administrators when an automation triggers on > 100 recipients and is held for approval.
    """
    now_str = datetime.now().strftime("%d %b %Y, %I:%M %p IST")
    subject = f"⚠️ [Approval Required] Automation '{rule_name}' queued for {recipient_count} WhatsApp recipients"
    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; border: 1px solid #E5E7EB; border-radius: 12px; overflow: hidden; background: #FFFFFF;">
      <div style="background: #111827; padding: 20px 24px; color: white; border-bottom: 3px solid #F5A623;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <h2 style="margin: 0; font-size: 18px; font-weight: bold; color: #F5A623;">⚠️ Permission & Approval Gate</h2>
          <span style="background: #FEF3C7; color: #92400E; font-size: 11px; font-weight: bold; padding: 3px 8px; border-radius: 9999px;">&gt; 100 Recipients</span>
        </div>
        <p style="margin: 4px 0 0 0; font-size: 12px; color: #9CA3AF;">Automation Rule execution paused pending admin approval</p>
      </div>

      <div style="padding: 24px; color: #1F2937; line-height: 1.6;">
        <p style="margin-top: 0; font-size: 14px;">Hello Admin,</p>
        <p style="font-size: 13px; color: #4B5563;">
          The automation rule <strong>"{rule_name}"</strong> has met its trigger condition (<code>{condition}</code>) and has identified <strong>{recipient_count} eligible contacts</strong>.
        </p>

        <div style="background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px; margin: 18px 0;">
          <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
            <tr>
              <td style="color: #6B7280; padding: 4px 0; width: 40%;">Automation Rule:</td>
              <td style="font-weight: bold; color: #111827;">{rule_name} (ID: #{rule_id})</td>
            </tr>
            <tr>
              <td style="color: #6B7280; padding: 4px 0;">Target Recipients:</td>
              <td style="font-weight: bold; color: #DC2626;">{recipient_count} contacts (&gt; 100 threshold)</td>
            </tr>
            <tr>
              <td style="color: #6B7280; padding: 4px 0;">WhatsApp Template:</td>
              <td style="font-weight: bold; color: #111827;"><code>{template_name}</code></td>
            </tr>
            <tr>
              <td style="color: #6B7280; padding: 4px 0;">Status:</td>
              <td style="font-weight: bold; color: #D97706;">HELD_FOR_APPROVAL</td>
            </tr>
          </table>
        </div>

        <div style="background: #EFF6FF; padding: 12px 16px; border-radius: 8px; border-left: 4px solid #3B82F6; font-size: 12px; color: #1E40AF; margin-bottom: 20px;">
          <strong>Security Protocol:</strong> Because this action will dispatch messages to more than 100 phone numbers, the system requires your explicit permission and 2FA authentication to prevent accidental mass charges or spam.
        </div>

        <div style="text-align: center; margin: 24px 0;">
          <a href="{DASHBOARD_URL}/#automations" style="display: inline-block; background: #25D366; color: #000000; font-weight: bold; font-size: 14px; text-decoration: none; padding: 12px 24px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            Review & Approve in Dashboard →
          </a>
        </div>
      </div>

      <div style="background: #F9FAFB; padding: 12px 24px; text-align: center; font-size: 11px; color: #9CA3AF; border-top: 1px solid #F3F4F6;">
        Manubhai Gathiyawala WhatsApp CRM • High-Volume Safeguard System
      </div>
    </div>
    """
    return send_email_alert(subject=subject, html_body=html_body, priority="high")

