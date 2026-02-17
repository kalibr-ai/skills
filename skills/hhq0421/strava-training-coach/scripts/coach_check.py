#!/usr/bin/env python3
"""
Training Coach - Daily check for injury risks and training insights
Focuses on 80/20 principle and sustainable training

Improvements in v2:
- Better error handling with detailed logging
- Smarter recovery gap detection (distinguishes planned vs unplanned rest)
- Verbose mode for debugging
- State persistence across runs
- Graceful degradation when APIs fail
"""

import os
import sys
import json
import urllib.request
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, List, Any, Tuple

# ============================================================================
# CONFIGURATION
# ============================================================================

TOKEN_FILE = os.path.expanduser('~/.strava_tokens.json')
STATE_FILE = os.path.expanduser('~/.strava_coach_state.json')
LOG_FILE = os.path.expanduser('~/.strava_coach.log')

# User-configurable thresholds
MAX_WEEKLY_JUMP = float(os.environ.get('MAX_WEEKLY_MILEAGE_JUMP', 30))  # %
MAX_HARD_PERCENT = float(os.environ.get('MAX_HARD_DAY_PERCENTAGE', 25))  # %
EASY_HR_CEILING = int(os.environ.get('MIN_EASY_RUN_HEART_RATE', 145))
NOTIFICATION_CHANNEL = os.environ.get('NOTIFICATION_CHANNEL', 'discord')
PLANNED_REST_DAYS = int(os.environ.get('PLANNED_REST_DAYS', 2))  # Max planned rest before alerting
VERBOSE = os.environ.get('VERBOSE', 'false').lower() == 'true'

# ============================================================================
# LOGGING SETUP
# ============================================================================

def setup_logging() -> logging.Logger:
    """Configure logging to file and console"""
    logger = logging.getLogger('training_coach')
    logger.setLevel(logging.DEBUG if VERBOSE else logging.INFO)
    
    # Clear existing handlers
    logger.handlers = []
    
    # File handler (detailed logs)
    file_handler = logging.FileHandler(LOG_FILE)
    file_handler.setLevel(logging.DEBUG)
    file_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    file_handler.setFormatter(file_formatter)
    logger.addHandler(file_handler)
    
    # Console handler (user-facing)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_formatter = logging.Formatter('%(message)s')
    console_handler.setFormatter(console_formatter)
    logger.addHandler(console_handler)
    
    return logger

logger = setup_logging()

# ============================================================================
# STATE MANAGEMENT
# ============================================================================

class CoachState:
    """Persist state across runs to detect patterns"""
    
    def __init__(self):
        self.last_run: Optional[str] = None
        self.last_alert_time: Optional[str] = None
        self.alert_count_24h: int = 0
        self.planned_rest_start: Optional[str] = None
        self.weekly_mileage_history: List[Dict] = []
    
    @classmethod
    def load(cls) -> 'CoachState':
        """Load state from file"""
        try:
            with open(STATE_FILE) as f:
                data = json.load(f)
                state = cls()
                state.__dict__.update(data)
                return state
        except (FileNotFoundError, json.JSONDecodeError):
            return cls()
    
    def save(self):
        """Save state to file"""
        try:
            with open(STATE_FILE, 'w') as f:
                json.dump(self.__dict__, f, indent=2, default=str)
        except Exception as e:
            logger.error(f"Failed to save state: {e}")
    
    def should_alert(self, alert_type: str) -> bool:
        """Check if we should send this alert (rate limiting)"""
        # Don't send same alert type within 6 hours
        if self.last_alert_time:
            last = datetime.fromisoformat(self.last_alert_time)
            if (datetime.now(timezone.utc) - last).hours < 6:
                return False
        return True

# ============================================================================
# STRAVA API
# ============================================================================

def get_webhook_url() -> Optional[str]:
    """Get webhook URL based on channel type"""
    if NOTIFICATION_CHANNEL == 'slack':
        return os.environ.get('SLACK_WEBHOOK_URL')
    # Default: #longevity (Strava) channel webhook
    # Note: Set DISCORD_WEBHOOK_URL env var, or use default below
    return os.environ.get('DISCORD_WEBHOOK_URL') or "https://discord.com/api/webhooks/1473212005556158466/yuIYhylHYBWG4DNFMyopRIJVJIpFI0RQX5noKX-ax2htGlOzqEmwMJXyFFbHFhg6sCAr"


def load_tokens() -> Optional[str]:
    """Load Strava tokens and refresh if expired"""
    try:
        with open(TOKEN_FILE) as f:
            data = json.load(f)
            access_token = data.get('access_token')
            refresh_token = data.get('refresh_token')
            expires_at = data.get('expires_at', 0)
            
            # Check if token is expired (with 5 min buffer)
            if expires_at and expires_at < (datetime.now().timestamp() + 300):
                logger.info("Token expired, refreshing...")
                return refresh_access_token(refresh_token)
            
            logger.debug(f"Token valid until {datetime.fromtimestamp(expires_at)}")
            return access_token
            
    except FileNotFoundError:
        logger.error(f"Token file not found: {TOKEN_FILE}")
        return None
    except json.JSONDecodeError as e:
        logger.error(f"Invalid token file: {e}")
        return None


def refresh_access_token(refresh_token: str) -> Optional[str]:
    """Refresh expired access token"""
    import urllib.parse
    
    client_id = os.environ.get('STRAVA_CLIENT_ID')
    client_secret = os.environ.get('STRAVA_CLIENT_SECRET')
    
    if not client_id or not client_secret:
        logger.error("STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET required")
        return None
    
    url = 'https://www.strava.com/oauth/token'
    data = {
        'client_id': client_id,
        'client_secret': client_secret,
        'refresh_token': refresh_token,
        'grant_type': 'refresh_token'
    }
    
    req = urllib.request.Request(
        url,
        data=urllib.parse.urlencode(data).encode(),
        headers={'Content-Type': 'application/x-www-form-urlencoded'},
        method='POST'
    )
    
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            new_tokens = json.loads(response.read().decode())
            with open(TOKEN_FILE, 'w') as f:
                json.dump(new_tokens, f, indent=2)
            logger.info("Token refreshed successfully")
            return new_tokens.get('access_token')
    except urllib.error.HTTPError as e:
        logger.error(f"Token refresh failed: {e.code} - {e.read().decode()}")
        return None
    except Exception as e:
        logger.error(f"Token refresh error: {e}")
        return None


def fetch_activities(access_token: str, days: int = 14) -> List[Dict]:
    """Fetch activities with retry logic and client-side filtering"""
    url = f'https://www.strava.com/api/v3/athlete/activities?per_page=50'
    
    headers = {
        'Authorization': f'Bearer {access_token}',
        'User-Agent': 'TrainingCoach/2.0'
    }
    
    max_retries = 3
    for attempt in range(max_retries):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=30) as response:
                activities = json.loads(response.read().decode())
                
                # Client-side filtering by date
                cutoff = datetime.now(timezone.utc) - timedelta(days=days)
                filtered = [
                    a for a in activities 
                    if datetime.fromisoformat(a['start_date'].replace('Z', '+00:00')) > cutoff
                ]
                
                logger.debug(f"Fetched {len(activities)} activities, {len(filtered)} within last {days} days")
                return filtered
                
        except urllib.error.HTTPError as e:
            if e.code == 401:
                logger.error("Authentication failed - token may be invalid")
                return []
            logger.warning(f"HTTP error (attempt {attempt + 1}): {e.code}")
            if attempt == max_retries - 1:
                return []
        except Exception as e:
            logger.error(f"Fetch error (attempt {attempt + 1}): {e}")
            if attempt == max_retries - 1:
                return []
    
    return []


# ============================================================================
# ANALYSIS FUNCTIONS
# ============================================================================

def analyze_weekly_load(activities: List[Dict]) -> Tuple[Optional[Dict], float]:
    """
    Check for dangerous mileage spikes between weeks.
    Returns (alert_dict or None, this_week_mileage)
    """
    if not activities:
        return None, 0.0
    
    now = datetime.now(timezone.utc)
    week_start = now - timedelta(days=now.weekday())
    last_week_start = week_start - timedelta(days=7)
    
    this_week = []
    last_week = []
    
    for a in activities:
        try:
            act_date = datetime.fromisoformat(a['start_date'].replace('Z', '+00:00'))
            if act_date >= week_start:
                this_week.append(a)
            elif act_date >= last_week_start:
                last_week.append(a)
        except (ValueError, KeyError) as e:
            logger.warning(f"Skipping activity with invalid date: {e}")
            continue
    
    this_miles = sum(a.get('distance', 0) for a in this_week) / 1609.34
    last_miles = sum(a.get('distance', 0) for a in last_week) / 1609.34
    
    logger.debug(f"This week: {this_miles:.1f} mi, Last week: {last_miles:.1f} mi")
    
    if last_miles == 0:
        # First week of data - no comparison possible
        return None, this_miles
    
    change_pct = ((this_miles - last_miles) / last_miles) * 100
    
    if change_pct > MAX_WEEKLY_JUMP:
        severity = 'high' if change_pct > 50 else 'medium'
        return {
            'type': 'load_spike',
            'severity': severity,
            'message': f"Weekly mileage up {change_pct:.0f}% ({last_miles:.1f}→{this_miles:.1f} mi). Risk of injury increases significantly above 10% weekly gains.",
            'recommendation': "Consider an easy week or cut next week's mileage by 20%."
        }, this_miles
    
    return None, this_miles


def analyze_intensity(activities: List[Dict]) -> Optional[Dict]:
    """Check if easy days are actually easy (80/20 rule)"""
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    
    recent = []
    for a in activities:
        try:
            act_date = datetime.fromisoformat(a['start_date'].replace('Z', '+00:00'))
            if act_date > cutoff:
                recent.append(a)
        except ValueError:
            continue
    
    if len(recent) < 3:
        logger.debug(f"Not enough activities for intensity analysis ({len(recent)} < 3)")
        return None
    
    hard_runs = 0
    total_runs = 0
    runs_with_hr = 0
    
    for a in recent:
        if a.get('type') == 'Run':
            total_runs += 1
            avg_hr = a.get('average_heartrate', 0)
            if avg_hr > 0:
                runs_with_hr += 1
                if avg_hr > EASY_HR_CEILING:
                    hard_runs += 1
    
    if total_runs == 0:
        return None
    
    # If no HR data available, skip this check
    if runs_with_hr == 0:
        logger.debug("No heart rate data available for intensity analysis")
        return None
    
    hard_pct = (hard_runs / runs_with_hr) * 100
    logger.debug(f"Hard runs: {hard_pct:.0f}% ({hard_runs}/{runs_with_hr})")
    
    if hard_pct > MAX_HARD_PERCENT:
        return {
            'type': 'intensity_imbalance',
            'severity': 'medium',
            'message': f"{hard_pct:.0f}% of runs with HR data were moderate/high effort (HR >{EASY_HR_CEILING}).",
            'recommendation': "Easy days should feel conversational. Slow down to build aerobic base."
        }
    
    return None


def check_recovery_gap(activities: List[Dict], state: CoachState) -> Optional[Dict]:
    """
    Check for too many rest days in a row.
    Distinguishes planned rest (e.g., taper week) from unplanned gaps.
    """
    if not activities:
        return None
    
    try:
        last_activity = datetime.fromisoformat(
            activities[0]['start_date'].replace('Z', '+00:00')
        )
    except (ValueError, KeyError):
        logger.error("Invalid activity date format")
        return None
    
    now = datetime.now(timezone.utc)
    days_since = (now - last_activity).days
    
    logger.debug(f"Days since last activity: {days_since}")
    
    # Don't alert for planned rest (up to PLANNED_REST_DAYS)
    if days_since < PLANNED_REST_DAYS:
        return None
    
    # Check if this looks like planned rest vs forgotten
    # Planned rest: recent consistent activity before gap
    # Unplanned: sporadic activity or sudden stop
    recent_consistency = len([a for a in activities[:7] if 
        (now - datetime.fromisoformat(a['start_date'].replace('Z', '+00:00'))).days <= 10])
    
    is_planned = recent_consistency >= 5 and days_since <= 5
    
    if is_planned:
        logger.debug("Gap appears to be planned rest - not alerting")
        return None
    
    if days_since >= 5:
        return {
            'type': 'recovery_gap',
            'severity': 'low',
            'message': f"{days_since} days since last activity.",
            'recommendation': "A gentle 20-min walk or yoga can aid recovery without adding fatigue."
        }
    
    return None


def check_consistency_streak(activities: List[Dict]) -> Optional[Dict]:
    """Check for streak milestones (consecutive days with activity)"""
    if not activities:
        return None
    
    streak = 0
    now = datetime.now(timezone.utc)
    
    for i, a in enumerate(activities):
        try:
            act_date = datetime.fromisoformat(a['start_date'].replace('Z', '+00:00'))
            expected_date = now - timedelta(days=i)
            
            # Allow 1 day tolerance for timezone edge cases
            if abs((act_date.date() - expected_date.date()).days) <= 1:
                streak += 1
            else:
                break
        except ValueError:
            continue
    
    logger.debug(f"Current streak: {streak} days")
    
    milestones = [7, 14, 30, 60, 100]
    for milestone in milestones:
        if streak == milestone:
            return {
                'type': 'streak_milestone',
                'severity': 'positive',
                'message': f"🔥 {milestone}-Day Streak!",
                'recommendation': "Consistency beats intensity. Well done."
            }
    
    return None


# ============================================================================
# NOTIFICATIONS
# ============================================================================

def send_discord_alert(alert: Dict, webhook_url: str) -> bool:
    """Send alert to Discord webhook"""
    colors = {
        'high': 0xFF4444,
        'medium': 0xFFA500,
        'low': 0xFFFF00,
        'positive': 0x44FF44
    }
    
    title = "🎉 Achievement" if alert['severity'] == 'positive' else "🏃 Training Coach Alert"
    
    embed = {
        "title": title,
        "color": colors.get(alert['severity'], 0x888888),
        "fields": [
            {"name": "Issue", "value": alert['message'][:1000], "inline": False},
            {"name": "Recommendation", "value": alert['recommendation'][:1000], "inline": False}
        ],
        "footer": {"text": "80/20 Rule: Easy days easy, hard days hard"},
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    payload = {"embeds": [embed]}
    
    req = urllib.request.Request(
        webhook_url,
        data=json.dumps(payload).encode(),
        headers={
            'Content-Type': 'application/json',
            'User-Agent': 'Strava-Training-Coach/2.0'
        },
        method='POST'
    )
    
    try:
        with urllib.request.urlopen(req, timeout=30):
            logger.info(f"Discord alert sent: {alert['type']}")
            return True
    except Exception as e:
        logger.error(f"Discord alert failed: {e}")
        return False


def send_slack_alert(alert: Dict, webhook_url: str) -> bool:
    """Send alert to Slack webhook"""
    emoji = {'high': '🚨', 'medium': '⚠️', 'low': '💡', 'positive': '🎉'}
    
    payload = {
        "text": f"{emoji.get(alert['severity'], 'ℹ️')} *Training Coach*",
        "blocks": [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*{alert['message'][:3000]}*\n\n{alert['recommendation'][:3000]}"
                }
            },
            {
                "type": "context",
                "elements": [
                    {"type": "mrkdwn", "text": "80/20 Rule: Easy days easy, hard days hard"}
                ]
            }
        ]
    }
    
    req = urllib.request.Request(
        webhook_url,
        data=json.dumps(payload).encode(),
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    
    try:
        with urllib.request.urlopen(req, timeout=30):
            logger.info(f"Slack alert sent: {alert['type']}")
            return True
    except Exception as e:
        logger.error(f"Slack alert failed: {e}")
        return False


# ============================================================================
# MAIN
# ============================================================================

def main() -> int:
    """Main entry point"""
    logger.info(f"🏃 Training Coach Check - {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    logger.info("=" * 50)
    
    # Load state
    state = CoachState.load()
    state.last_run = datetime.now(timezone.utc).isoformat()
    
    # Load tokens
    access_token = load_tokens()
    if not access_token:
        logger.error("❌ No Strava tokens. Run auth.py first.")
        return 1
    
    # Get webhook
    webhook_url = get_webhook_url()
    if not webhook_url:
        logger.error(f"❌ No webhook URL for {NOTIFICATION_CHANNEL}")
        return 1
    
    # Fetch activities
    activities = fetch_activities(access_token)
    if not activities:
        logger.info("No recent activities found.")
        state.save()
        return 0
    
    logger.info(f"Found {len(activities)} recent activities\n")
    
    # Run checks
    alerts = []
    
    # Weekly load check
    load_alert, weekly_miles = analyze_weekly_load(activities)
    if load_alert:
        alerts.append(load_alert)
        logger.info(f"⚠️  Load spike detected: {weekly_miles:.1f} mi")
    else:
        logger.info(f"✅ Weekly load OK: {weekly_miles:.1f} mi")
    
    # Intensity check
    intensity_alert = analyze_intensity(activities)
    if intensity_alert:
        alerts.append(intensity_alert)
        logger.info(f"⚠️  Intensity imbalance detected")
    else:
        logger.info("✅ Intensity distribution OK")
    
    # Recovery gap check
    recovery_alert = check_recovery_gap(activities, state)
    if recovery_alert:
        alerts.append(recovery_alert)
        logger.info(f"💡 Recovery gap: {recovery_alert['message']}")
    
    # Streak check
    streak_alert = check_consistency_streak(activities)
    if streak_alert:
        alerts.append(streak_alert)
        logger.info(f"🎉 {streak_alert['message']}")
    
    # Send alerts
    if alerts:
        logger.info(f"\n📤 Sending {len(alerts)} alert(s)...")
        for alert in alerts:
            if NOTIFICATION_CHANNEL == 'slack':
                send_slack_alert(alert, webhook_url)
            else:
                send_discord_alert(alert, webhook_url)
        
        state.last_alert_time = datetime.now(timezone.utc).isoformat()
    else:
        logger.info("\n✅ All checks passed. No alerts needed.")
    
    # Save state
    state.save()
    
    logger.info(f"\n{'=' * 50}\n")
    return 0


if __name__ == '__main__':
    sys.exit(main())
