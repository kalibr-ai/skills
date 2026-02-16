"""Configuration management for Linear Todos."""

import json
import os
from pathlib import Path
from typing import Optional


class Config:
    """Manages configuration for Linear Todos.
    
    Configuration is loaded in this order (later overrides earlier):
    1. Default values (none)
    2. Config file: ~/.config/linear-todos/config.json
    3. Environment variables: LINEAR_*
    """
    
    CONFIG_DIR = Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config")) / "linear-todos"
    CONFIG_FILE = CONFIG_DIR / "config.json"
    
    def __init__(self):
        self._config = {}
        self._load_config()
    
    def _load_config(self) -> None:
        """Load configuration from file and environment variables."""
        # Start with config file if it exists
        if self.CONFIG_FILE.exists():
            try:
                with open(self.CONFIG_FILE, "r") as f:
                    self._config = json.load(f)
            except (json.JSONDecodeError, IOError):
                self._config = {}
        
        # Also check legacy credentials location
        if not self._config.get("apiKey"):
            legacy_creds = Path.home() / ".clawdbot" / "credentials" / "linear.json"
            if legacy_creds.exists():
                try:
                    with open(legacy_creds, "r") as f:
                        legacy = json.load(f)
                        if "apiKey" in legacy and "apiKey" not in self._config:
                            self._config["apiKey"] = legacy["apiKey"]
                except (json.JSONDecodeError, IOError):
                    pass
        
        # Environment variables override config file
        env_mappings = {
            "LINEAR_API_KEY": "apiKey",
            "LINEAR_TEAM_ID": "teamId",
            "LINEAR_STATE_ID": "stateId",
            "LINEAR_DONE_STATE_ID": "doneStateId",
        }
        
        for env_var, config_key in env_mappings.items():
            value = os.environ.get(env_var)
            if value:
                self._config[config_key] = value
    
    @property
    def api_key(self) -> Optional[str]:
        """Get the Linear API key."""
        return self._config.get("apiKey")
    
    @property
    def team_id(self) -> Optional[str]:
        """Get the team ID."""
        return self._config.get("teamId")
    
    @property
    def state_id(self) -> Optional[str]:
        """Get the initial state ID for new todos."""
        return self._config.get("stateId")
    
    @property
    def done_state_id(self) -> Optional[str]:
        """Get the done state ID."""
        return self._config.get("doneStateId")
    
    def save(self, api_key: str, team_id: str, state_id: str, 
             done_state_id: Optional[str] = None) -> None:
        """Save configuration to file.
        
        Args:
            api_key: Linear API key
            team_id: Team ID for todos
            state_id: Initial state ID for new todos
            done_state_id: State ID for completed todos
        """
        self.CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        
        config = {
            "apiKey": api_key,
            "teamId": team_id,
            "stateId": state_id,
        }
        
        if done_state_id:
            config["doneStateId"] = done_state_id
        
        with open(self.CONFIG_FILE, "w") as f:
            json.dump(config, f, indent=2)
        
        self._config = config
    
    def is_configured(self) -> bool:
        """Check if the minimum required configuration is present.
        
        Returns:
            True if api_key and team_id are set
        """
        return bool(self.api_key and self.team_id)
    
    def __repr__(self) -> str:
        return f"Config(team_id={self.team_id}, configured={self.is_configured()})"
